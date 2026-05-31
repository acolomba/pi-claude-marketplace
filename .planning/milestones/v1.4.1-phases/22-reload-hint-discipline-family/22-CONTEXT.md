# Phase 22: Reload-hint Discipline Family - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Reserve the `/reload to pick up changes` trailer for operations that actually
change a **Pi-visible resource** (a skill / agent / command / MCP entry). A
read-only or zero-resource-change marketplace operation must not emit it.

Single chokepoint: `shouldEmitReloadHint` (`shared/notify.ts:1111`). Closes the
three currently-misfiring cases from the v1.4 milestone-spanning UAT:

- **G-MIL-01** -- `marketplace add` of an empty marketplace emits the trailer.
- **G-MIL-02** -- `marketplace remove` of a marketplace with no installed plugins emits the trailer.
- **G-MIL-06** -- `marketplace update` whose plugin cascade is all no-ops emits the trailer.

Closes **SNM-33**. Mirrors the G-21-01 fix landed in Plan 21-04 (renderer
byte-identical, reload-gate keyed to a true state-change discriminator).

**In scope:** the reload-hint trigger logic and the orchestrator payload shapes
that feed it; the catalog/fixture/test updates required to keep byte-equality
GREEN.

**Out of scope:** version display (Phase 23), grammar leak (Phase 24), runtime
publish/verification (Phase 25). No state-migration tooling. No new commands.
</domain>

<decisions>
## Implementation Decisions

### Chokepoint rule (the core fix)
- **D-22-01:** Collapse `shouldEmitReloadHint` to a **single, purely
  plugin-row-driven rule**: trigger iff any `mp.plugins[]` row carries a
  state-change discriminator -- `installed` / `updated` / `reinstalled` /
  `uninstalled`. **Delete every marketplace-status arm** (`added`, `removed`,
  `updated`, `autoupdate enabled`, `autoupdate disabled`). Rationale: once
  clean-remove carries its `(uninstalled)` rows (D-22-02) and the autoupdate
  arms are dropped (D-22-03), every marketplace-status arm is redundant -- `add`,
  `update`-manifest-refresh, empty-remove, and autoupdate-flips all emit
  `plugins:[]`, and every genuine Pi-visible change is represented as a plugin
  row. This is cleaner than per-arm gating and encodes the user's principle
  directly: *marketplace records are not Pi-visible resources; only plugin
  rows are.* The resulting function is just the existing inner plugin loop.

### Remove signal -- clean path carries its uninstalled rows
- **D-22-02:** Change the clean `marketplace remove` path
  (`orchestrators/marketplace/remove.ts:327-340`) to populate `plugins[]` with
  one `PluginUninstalledMessage` per `successfullyUnstaged` plugin (mirroring
  the shape the partial-failure path at `:305-320` already emits). Empty remove
  → `plugins:[]` → header-only → no trailer (G-MIL-02). Non-empty remove → N
  `(uninstalled)` rows → trailer fires via D-22-01 (satisfies SC#4). This is a
  **content-driven** resolution chosen over a hidden count/flag field: it keeps
  the reload decision computed-from-contents (D-16-12 / SNM-15) with no new
  field on `MarketplaceNotificationMessage`, matches SNM-33's literal
  "`plugins[].some(state-change)`" wording, and aligns with the UAT test-19
  expectation that remove shows per-plugin `(uninstalled)` rows.
- **Reverses** the deliberate V2 "clean `marketplace remove` = header alone,
  reload fires regardless" contract (remove.ts:327-330 comment / RESEARCH
  Risks #7 / catalog `docs/output-catalog.md:15`). That reversal is the
  intended catalog change for this phase.

### Autoupdate -- extend the same discipline
- **D-22-03:** `autoupdate enabled` / `autoupdate disabled` also stop emitting
  the trailer. They change only a marketplace-record flag (no skill/agent/
  command/MCP entry changes) -- the same principle behind G-MIL-01/02/06. Under
  D-22-01 this is automatic (autoupdate flips emit `plugins:[]`, so deleting
  their arms suffices; no special handling). **Supersedes the reload-trigger
  half of D-17.1-02** for these two arms (the rest of D-17.1-02 -- the 7-entry
  `MARKETPLACE_STATUSES`, the `skipped→warning` severity route, the catalog
  state blocks -- stays intact). Record as a logged decision in PROJECT.md.

### Test breadth
- **D-22-04:** Ship the 3 SNM-33-mandated negative regression tests in
  `tests/shared/notify-v2.test.ts` (empty `add` → no trailer; empty `remove` →
  no trailer; no-op `update` cascade → no trailer) **and** positive
  "still-fires" guards for the SC#4 paths (remove that uninstalled ≥1 plugin →
  trailer; update with ≥1 changed plugin → trailer). The positive guards lock
  against a future over-eager gate silently regressing the state-change paths.

### `add` end-state (derived, confirmed)
- **D-22-05 [informational]:** `marketplace add` will **never** emit the trailer -- `add.ts:170`
  only ever emits `{status:"added", plugins:[]}` (it does not cascade-install;
  Claude-Code parity). SC#4's "add whose cascade installed ≥1 plugin" clause is
  vacuous today; the D-22-01 rule is forward-correct should `add` ever construct
  `installed` rows. No work to add an install cascade in this phase.

### Catalog / fixture lockstep (required for GREEN at the phase boundary)
- **D-22-06:** Update in lockstep with the source change:
  - `docs/output-catalog.md` -- clean-remove byte form (now header + N
    `(uninstalled)` rows; empty-remove stays header-only); the reload-hint rule
    (`:64-68`) drops the "marketplace status in {added, removed, updated}"
    trigger bullet entirely; the `marketplace remove` section narrative
    (`:749+`) and the line-15 "marketplace-only command renders header alone"
    note amended to reflect that only the **empty** remove is header-alone;
    the autoupdate `enable-fresh` / `disable-fresh` catalog blocks lose their
    `/reload` trailer.
  - `tests/architecture/catalog-uat.test.ts` -- `clean` remove fixture
    (~`:1154-1183`) and the autoupdate fresh-flip fixtures updated to match.
  - `tests/shared/notify-v2.test.ts` -- remove + autoupdate byte fixtures
    updated; D-22-04 negative + positive tests added.

### Claude's Discretion
- Exact final form of the collapsed `shouldEmitReloadHint` body and its
  docblock wording.
- Whether to fold the `PluginUninstalledMessage` mapping in remove.ts into a
  shared helper with the partial path's identical mapping (`:305-320`).
- Plan/wave decomposition (this is a small, single-file-converging fix).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement & gap source
- `.planning/REQUIREMENTS.md` §SNM-33 (`:14`) -- the requirement this phase closes (exact gate wording).
- `.planning/v1.4-MILESTONE-UAT.md` -- the gap inventory: G-MIL-01 (`:452`), G-MIL-02 (`:464`), G-MIL-06 (`:593`); reload-hint family triage (`:741-748`, `:759`, `:767`).
- `.planning/ROADMAP.md` -- Phase 22 goal + Success Criteria #1-#4 (`:400-415`); cross-cutting v1.4.1 constraints (`:85-91`).

### Chokepoint & type model
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `shouldEmitReloadHint` (`:1111-1136`), `computeSeverity` (`:1074-1099`, unaffected), `RELOAD_HINT_TRAILER` (`:1071`), `notify()` entry (`:1228-1260`), `MarketplaceNotificationMessage` (`:565-588`), `PluginUninstalledMessage` / status union.

### Orchestrators
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- clean path (`:327-340`), partial path (`:295-324`), `successfullyUnstaged` accumulator (`:201`, `:225-237`).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- sole notify (`:170-177`, always `plugins:[]`).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- failure (`:623-625`), manifest-refresh-only (`:657-661`, `plugins:[]`), cascade (`:674-683`).

### Contract / spec
- `docs/output-catalog.md` -- reload-hint rule (`:64-68`), header-alone note (`:15`), `(removed)` glyph (`:130`), `marketplace remove` section (`:749+`), autoupdate marker/section.
- `docs/adr/v2-001-structured-notify.md` -- D-16-12 (computed reload-hint), Phase 17.1 Amendment (autoupdate / D-17.1-02 to be superseded for the reload-trigger half).

### Precedent to mirror
- `.planning/phases/21-final-teardown-green-gate/` -- Plan 21-04 G-21-01 fix (`PluginPresentMessage` split: renderer byte-identical, reload-gate differs).

### Tests
- `extensions/pi-claude-marketplace/tests/shared/notify-v2.test.ts` -- byte fixtures + existing G-21-01 regressions (target for D-22-04).
- `extensions/pi-claude-marketplace/tests/architecture/catalog-uat.test.ts` -- per-command byte-equality runner (clean/partial remove + autoupdate fixtures).
- `extensions/pi-claude-marketplace/tests/architecture/notify-types.test.ts` -- closed-set proofs (no change expected since D-22-02 adds no type field).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PluginUninstalledMessage` shape already constructed at `remove.ts:305-311`
  (partial path) -- clean path (D-22-02) reuses the identical mapping over
  `successfullyUnstaged`.
- `shouldEmitReloadHint`'s existing inner plugin-row loop (`:1123-1132`) IS the
  final collapsed rule -- D-22-01 deletes the surrounding marketplace-status
  `if` block (`:1112-1121`) and keeps the loop.

### Established Patterns
- Reload-hint is computed from message contents at `notify()` time, never
  caller-supplied (D-16-12 / SNM-15). D-22-02's content-driven choice preserves
  this; a hidden flag was rejected to avoid reintroducing a caller-supplied
  reload signal.
- G-21-01 precedent: the reload-gate decision keys on a discriminator that is
  unambiguously transition-vs-inventory; every status either always triggers or
  never triggers. The collapsed rule keeps that invariant (no marketplace status
  triggers; the four plugin transition tokens always trigger).
- Catalog UAT byte-equality is the user-contract gate -- any rendered-output
  change (clean-remove rows; autoupdate-fresh trailer removal) updates
  `docs/output-catalog.md` + fixtures in the same commit.

### Integration Points
- `remove.ts` clean path → `plugins[]` → `composeMarketplaceBlock` /
  `renderPluginRow` (existing renderer handles `(uninstalled)` rows already;
  no renderer change needed).
- `shouldEmitReloadHint` is the sole reload decision site; `add` / `update` /
  autoupdate orchestrators need **no** change (their `plugins:[]` payloads are
  already correct under the collapsed rule).
</code_context>

<specifics>
## Specific Ideas

- The end-state `shouldEmitReloadHint` is expected to be essentially:
  "for each marketplace, for each plugin, if `p.status ∈ {installed, updated,
  reinstalled, uninstalled}` return true; else false" -- no marketplace-status
  branch.
- Empty `marketplace remove` and `marketplace add` both render the bare
  marketplace header with `plugins:[]` and no trailer; non-empty remove renders
  the header + indented `(uninstalled)` rows + trailer.
</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. (Autoupdate was folded **into**
scope per D-22-03 rather than deferred; the user chose to extend the discipline
now for consistency.)
</deferred>

---

*Phase: 22-reload-hint-discipline-family*
*Context gathered: 2026-05-28*
