# Phase 66: Derived Force-State, Glyphs & Force-Upgradability - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive two new plugin states from the resolver state — `force-installed` and
`force-upgradable` — with NO persisted flag and NO state migration, and drive
their display: distinct status tokens, glyphs (`◉` for force-installed, `●` for
the currently-clean force-upgradable), `will force install` / `will force
update` preview tokens, and `info` dropped-component detail. The force
install/update success notification reads "force-installed".

- `force-installed` = a plugin recorded as installed that currently re-resolves
  to `unsupported`.
- `force-upgradable` = a currently-clean installed plugin whose newer
  cache-resolved candidate would NEWLY degrade it; a force-installed plugin is
  never force-upgradable.

Builds on Phase 64 (three-way resolver state + render-time marker helper) and
Phase 65 (the `--force` install/update path). This phase is DISPLAY/DERIVATION
only — it adds no new persisted data.

Requirements FSTAT-01..07 and the five success criteria are locked by the
ROADMAP — discussion below is HOW, not WHAT.

</domain>

<decisions>
## Implementation Decisions

### Derivation seam (FSTAT-01, FSTAT-03)
- **D-66-01:** A SINGLE shared deriver computes the realized status from
  (recorded-installed record + current resolver state): recorded-installed AND
  resolves `unsupported` → `force-installed`; recorded-installed AND resolves
  `installable` → `installed`. All surfaces (list, cascade, `info`, success
  notification) read this one deriver. NO persisted `forceInstalled` flag, NO
  state migration. FSTAT-03 (force-installed → `(installed)` after a
  fully-supported upgrade) falls out for free: once the newer version resolves
  `installable`, the same deriver yields `installed` with no lingering state.

### force-upgradable computation (FSTAT-04, FSTAT-05)
- **D-66-02:** Reuse the EXISTING no-network (cache) candidate resolution that
  already drives `upgradable`. Mark `force-upgradable` when the current resolve
  is `installable` (clean) AND the candidate resolve is `unsupported` (newly
  degrades). Exclude any plugin already `force-installed` (already degraded → it
  is force-installed, never force-upgradable). No separate candidate path.

### Tokens & glyphs (FSTAT-02, FSTAT-04)
- **D-66-03:** Extend the notify.ts status union with `force-installed` (new
  glyph `ICON_FORCE_INSTALLED = "◉"`, U+25C9) and `force-upgradable` (reuses
  `ICON_INSTALLED = "●"`, because the row is currently clean). Add both to the
  exhaustive glyph switch and lean on the existing `assertNever` so every render
  site must handle them at compile time. `◉` is distinct from the `●` installed
  glyph (FSTAT-02).

### Preview / info / notification threading (FSTAT-06, FSTAT-07)
- **D-66-04:** Thread the SAME derived force signal into all display surfaces
  (consistent with D-66-01's single deriver):
  - Pending/preview: render `will force install` / `will force update` in place
    of `will install` / `will update` when a force operation is planned.
  - `info`: report `force-installed` and surface the dropped-component detail
    via the Phase 64 render-time marker helper (`narrowUnsupportedKinds`).
  - Success notification: the force install/update success row reads
    "force-installed" (not "installed").

### Grammar dependency (post-insert, Phase 65.1)
- **D-66-05:** This phase was RE-PLANNED after Phase 65.1 corrected the
  `will`-grammar. Consequences for D-66-03/04:
  - The closed-set baseline is now `STATUS_TOKENS = 20` and
    `MARKETPLACE_STATUSES = 7` (65.1 retired marketplace `will add`/`will
    remove`). Adding `force-installed` + `force-upgradable` moves
    `STATUS_TOKENS` 20→22 and `PLUGIN_STATUSES` 15→17 — recompute the tripwire
    bumps against the CURRENT code, not the pre-65.1 values.
  - FSTAT-06's `will force install` builds on the surviving plugin `will
    install` token. `will force update` is VACUOUS — the pending/reconcile
    surface has no update action (confirmed in 65.1), so there is nothing to
    replace; implement only `will force install` and document the absence. The
    byte-exact `will force update` reconcile is not pursued.

### Claude's Discretion
- Exact deriver helper name/location, the shape of the recorded-state record it
  consumes, and where the candidate-supportability comparison slots into the
  existing list/upgradable path — left to planning, provided behavior matches
  D-66-01..05.
- Byte-exact preview/info/notification wording is finalized against the catalog
  in Phase 70 (DOC); this phase implements the tokens and the glyph values.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Status model + glyphs (the surface being extended)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `PluginRow`/status
  union, `ICON_INSTALLED`/`ICON_AVAILABLE`/`ICON_UNINSTALLABLE`/`ICON_DISABLED`
  (~1293-1306), the exhaustive glyph switch + `assertNever`, the `upgradable`
  row composition (~1913), and the list-inventory PL-4 row filter (~3202).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` —
  `narrowUnsupportedKinds` / `narrowResolverNotes` render-time marker family
  (Phase 64 / D-64-02) reused for `info` dropped-component detail.

### Resolver + force foundation
- `extensions/pi-claude-marketplace/domain/resolver.ts` — three-way `state`,
  `requireForceInstallable`, the `unsupported` arm.
- `.planning/phases/64-resolver-three-way-state/64-CONTEXT.md` — D-64-01..07.
- `.planning/phases/65-force-install-update/65-CONTEXT.md` — D-65-01..05 (the
  `--force` path whose result this phase displays).

### Surfaces consuming the derived state
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts`
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — status→tool
  projection (must map the new force tokens).

### Requirements & specs
- `.planning/REQUIREMENTS.md` — FSTAT-01..07.
- `.planning/ROADMAP.md` — Phase 66 goal + success criteria.
- `docs/output-catalog.md`, `docs/messaging-style-guide.md` — current token/
  glyph legend (byte-exact reconciliation is Phase 70/DOC, not here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The existing no-network candidate resolution that drives `upgradable` —
  reused to detect force-upgradable (D-66-02).
- `narrowUnsupportedKinds` (probe-classifiers.ts) — Phase 64 render-time marker
  helper, reused for `info` dropped-component detail (D-66-04).
- The status union + exhaustive glyph switch + `assertNever` pattern in
  notify.ts — extended, not bypassed (D-66-03).

### Established Patterns
- Status tokens are a closed discriminated union; every render site is
  compile-forced via `assertNever` (this is the FSTAT-02/04 enforcement lever).
- Glyph constants are module-level `ICON_*` exports in notify.ts.
- `edge/handlers/tools.ts` projects statuses onto the tool surface
  (`installed`/`upgradable` → `[installed]`); the new force tokens need a
  projection mapping there too.
- Comment/test-title policy: D-66-NN / FSTAT-NN / NFR-N IDs, never GSD
  phase/plan references.

### Integration Points
- list / cascade / info / pending / success-notification all read the single
  deriver (D-66-01) and the extended status union (D-66-03).

</code_context>

<specifics>
## Specific Ideas

The phase is deliberately derivation-only: it introduces zero persisted data.
The correctness lever is that `force-installed` and `force-upgradable` are pure
functions of (recorded-installed record, current resolver state, cache
candidate state). FSTAT-03's "returns to (installed) automatically" is a
consequence of that purity, not a separate code path. The exhaustive
`assertNever` switch is the structural mechanism that prevents any surface from
silently mis-rendering the new states.

</specifics>

<deferred>
## Deferred Ideas

- `--unsupported` list filter, `--force` completion sets, reinstall-as-repair —
  Phase 67 (LIST-01/02, RINST-01).
- Load-time backfill of previously-skipped components — Phase 68 (BFILL-01).
- Force-path severity ladder SEV-01..05 (the derived rows whose severity is
  stamped) — Phase 69.
- Byte-exact token/catalog reconciliation + PRD §11 — Phase 70 (DOC-01/02).

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 66-derived-force-state-glyphs*
*Context gathered: 2026-06-27*
