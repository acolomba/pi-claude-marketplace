# Phase 67: List Filters, Completion & Reinstall Repair - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose the Phase 66 derived force states on the `list` and tab-completion
surfaces, and convert `reinstall` into an unconditional repair primitive:

- `list` gains a `--unsupported` filter; `--installed` spans `installed` +
  `force-installed`; no `--upgradable` filter is added.
- With `--force` preceding the plugin positional, `install` completion offers
  `available` + `unsupported` and `update` completion offers `upgradable` +
  `force-upgradable` (`unavailable` excluded); without `--force`, completion is
  unchanged.
- `reinstall` no longer accepts `--force`; it always overwrites everything
  (collisions and foreign content).

Builds on Phase 66 (the derived `force-installed` / `force-upgradable` states)
and Phase 65 (the `--force` install/update flag). Surface/UX phase — no resolver
or state-model changes.

Requirements LIST-01, LIST-02, RINST-01 and the three success criteria are
locked by the ROADMAP — discussion below is HOW, not WHAT.

</domain>

<decisions>
## Implementation Decisions

### `--unsupported` filter scope (LIST-01)
- **D-67-01:** `list --unsupported` filters to plugins that resolve
  `unsupported` but are NOT installed (available-but-partial — the
  force-installable candidates). force-installed plugins are reached by
  `--installed` (which spans `installed` + `force-installed`), NOT by
  `--unsupported`. Each filter targets one realized state cleanly (mirrors how
  `--available` excludes installed). No `--upgradable` filter is added.

### Completion candidate sets (LIST-02)
- **D-67-02:** When `--force` precedes the plugin positional, source the
  candidate sets from the SAME Phase 66 derived-state classification `list`
  uses: `install` completion = `available` + `unsupported`; `update` completion
  = `upgradable` + `force-upgradable`; `unavailable` excluded in both. Without
  `--force`, completion output is byte-identical to today. No independent
  classification inside the completion provider.

### reinstall `--force` removal (RINST-01)
- **D-67-03:** Remove `--force` from reinstall's accepted flags so
  `reinstall --force` errors as an UNKNOWN flag (a clear signal the contract
  changed — not silently ignored). Make the orchestrator's overwrite-everything
  behavior (collisions + foreign content) UNCONDITIONAL by deleting the `force`
  option/branch. reinstall becomes a pure repair primitive. Remove `--force`
  from reinstall's usage string, the router help, and the completion flag list
  / positional-extraction special-case.

### Byte-contract scope
- **D-67-04:** Update EVERYTHING in lockstep in this phase — usage strings,
  router help, completion flag lists, notify/catalog-uat tests, AND the prose
  docs (`docs/output-catalog.md`, `docs/messaging-style-guide.md`) — matching
  how Phases 65.1 and 66 handled docs this milestone. `npm run check` stays
  green; Phase 70 only does the final PRD §11 reconcile.

### Claude's Discretion
- Exact flag-parsing helper changes in `list.ts` (BOOLEAN_FLAGS set) and the
  completion provider's `--force`-position detection — left to planning,
  provided behavior matches D-67-01..04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Surfaces being changed
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` — the
  `BOOLEAN_FLAGS` set (~24) and the filter switch (~49-53); add `--unsupported`,
  make `--installed` span force-installed.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` — the list
  filter flag descriptions (~103-105), the `--force` completion entry (~95), and
  the reinstall positional-extraction special-case (~261); add `--force`-gated
  candidate sets, remove reinstall `--force`.
- `extensions/pi-claude-marketplace/edge/completions/data.ts` — the candidate
  set source (~354) that completion narrows.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` — remove
  `--force` parsing (~25,31-50,75) + usage string.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — retire
  the `force?: boolean` option (~149) and make overwrite unconditional.
- `extensions/pi-claude-marketplace/edge/router.ts` — reinstall help line (~93)
  drops `--force`.

### Force-state foundation (the classification reused)
- `.planning/phases/66-derived-force-state-glyphs/66-CONTEXT.md` — D-66-01..05,
  the single deriver and the `force-installed`/`force-upgradable` states.
- `extensions/pi-claude-marketplace/shared/notify.ts` — the status union the
  filters/completion read.

### Byte-contract surfaces (lockstep, D-67-04)
- `docs/output-catalog.md`, `docs/messaging-style-guide.md`, the catalog-uat
  runner + notify tests.

### Requirements & specs
- `.planning/REQUIREMENTS.md` — LIST-01, LIST-02, RINST-01.
- `.planning/ROADMAP.md` — Phase 67 goal + success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Phase 66 derived-state classification used by `list` — reused verbatim by
  completion (D-67-02), avoiding a second classifier.
- The existing `--installed`/`--available`/`--unavailable` filter machinery in
  list.ts — extended with `--unsupported` and a widened `--installed`.
- reinstall's existing overwrite-everything code path (currently gated by
  `force`) — promoted to unconditional (D-67-03).

### Established Patterns
- Boolean list filters live in a `BOOLEAN_FLAGS` set + a token switch; completion
  flag descriptions mirror them in the provider.
- Reinstall already had a command-local `--force` (DIFFERENT meaning from the new
  install/update `--force`); this phase removes it, eliminating the overload.
- Comment/test-title policy: D-67-NN / LIST-NN / RINST-NN / NFR-N IDs, never GSD
  phase/plan references.

### Integration Points
- Completion `--force` detection must align with the install/update `--force`
  parsing added in Phase 65 (same flag, now also gating completion).
- The reinstall `--force` removal interacts with the completion provider's
  reinstall positional-extraction special-case (`["--force"]`) — drop it there
  too.

</code_context>

<specifics>
## Specific Ideas

The filters partition cleanly: `--installed` (installed + force-installed),
`--available`, `--unavailable`, `--unsupported` (not-installed unsupported). No
`--upgradable` filter (upgradable/force-upgradable are list-row states, not
filter selectors). reinstall's repurposing removes the last overloaded meaning
of `--force` in the command surface (install/update own `--force` now).

</specifics>

<deferred>
## Deferred Ideas

- Load-time backfill of force-installed plugins' skipped components — Phase 68.
- Force-path severity ladder SEV-01..05 — Phase 69.
- Final PRD §11 reconcile — Phase 70 (this phase updates output-catalog +
  style-guide per D-67-04).

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 67-list-filters-completion-reinstall-repair*
*Context gathered: 2026-06-27*
