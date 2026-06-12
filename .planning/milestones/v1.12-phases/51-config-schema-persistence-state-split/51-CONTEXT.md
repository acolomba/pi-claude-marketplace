# Phase 51: Config Schema, Persistence & State Split - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The frozen data foundation of v1.12: a typebox `CONFIG_SCHEMA` for `claude-plugins.json` +
`claude-plugins.local.json` per scope, a `loadConfig`/`saveConfig` seam mirroring
`persistence/state-io.ts`, the entry-level base+local merge producing `MergedConfig`, the
absent/unparseable/valid trichotomy, and the carve-out of desired-state fields from
`STATE_SCHEMA` into the config -- with ownership-split write seams enforced by architecture
test and the NFR-10 containment allow-list extended to the new paths. Every later v1.12
phase (migration, planner/dry-run, enable/disable, reconcile, write-back) reads these
shapes. Requirements: CFG-01, CFG-02, CFG-03, SPLIT-01, SPLIT-02.

Not in this phase: migration generation (Phase 52), the reconcile planner/diff command
(Phase 53), enable/disable commands (Phase 54), load wiring + reconcile notifications
(Phase 55), command write-back threading (Phase 56). Decisions below that constrain those
phases are recorded here because the Phase 51 shapes lock them in.

</domain>

<decisions>
## Implementation Decisions

### Config file shape
- **D-01 (layout):** Flat, two top-level records: `marketplaces` keyed by marketplace name,
  `plugins` keyed by `plugin@marketplace`. Each plugin is its own entry-level override unit
  (a `.local.json` can flip one plugin without replacing a marketplace's plugin set). No
  nesting of plugins under marketplaces.
- **D-02 (source representation):** Marketplace `source` is a raw string -- exactly what the
  user would pass to `marketplace add` -- classified at load through the existing
  `parsePluginSource` funnel in `domain/source.ts`. No structured-object source grammar.
- **D-03 (path anchor):** Relative path sources resolve against the project root (the
  directory containing `.pi/`) for project scope, and against the home directory for user
  scope; `~` expansion supported. Write-back records the same anchored form. Absolute paths
  allowed but not required for portability.
- **D-04 (defaults):** Entry fields are optional with defaults: marketplace `autoupdate`
  omitted = `false` (matches today: add never auto-enables autoupdate); plugin `enabled`
  omitted = `true`. `"plugin@mp": {}` is a valid entry. No boolean plugin shorthand.
- **D-05 (top-level optionality):** Both top-level records are optional; an absent record
  means empty. Accepted residual: a typo'd top-level key reads as empty at schema level --
  mass-prune sanity guarding is reconcile-phase (53/55) territory, not the schema's.

### Version pin semantics
- **D-06 (no version field):** The v1.12 config plugin entry carries NO `version` field.
  Config = pure user intent (source/autoupdate/enabled). Resolved versions stay machine
  bookkeeping in the internal state file. Installation has no version selector
  (`resolvePluginVersion` derives from the cached clone), so a config pin would be inert;
  pins with teeth are deferred to CFGV2-01.
- **D-07 (ENBL-02 reading):** "A disabled plugin keeps its version pin" = the internal
  record (resolved version + artefact records) survives disable, so `enable` re-materializes
  the same version from cache. SPLIT-01's "version pin" lives in the internal file, not the
  config, for v1.12.
- **D-08 (WB consequence, constrains Phase 56):** With no version field,
  `update`/`reinstall` config write-back reduces to "ensure the entry exists" -- no-op with
  no file rewrite when the entry is present; recreates it if hand-deleted while installed.

### Schema strictness & evolution
- **D-09 (lenient unknown keys -- user-revised decision):** Unknown keys are IGNORED on
  load, never abort. Only known keys with wrong types/shapes trigger the CFG-03 invalid
  classification. Accepted trade-off: typo'd field names are silently inert and defaults
  apply. (User initially picked strict, then explicitly reversed.)
- **D-10 (unknown keys round-trip):** Write-back's entry-level patches PRESERVE unknown
  fields inside any entry they touch. Unknown keys elsewhere survive untouched by
  construction because write-back never rewrites the whole file (constrains Phase 56).
- **D-11 (config schemaVersion):** Optional `schemaVersion` field; must equal `1` if
  present; omitted = 1. Write-back does not inject it into files that omit it.
- **D-12 (state schemaVersion):** No STATE_SCHEMA bump; `schemaVersion` stays `1`. The
  leftover `autoupdate` field on old state.json records is scrubbed on load via the existing
  legacy-migration path (`migrateLegacyMarketplaceRecords` + fire-and-forget persist).
- **D-13 (ORDERING RAIL, constrains Phase 52):** The autoupdate scrub must NOT destroy
  autoupdate intent before Phase 52's first-run migration captures it into the generated
  config. The migration reader must see the legacy field (e.g., scrub only when a config
  file already exists, or expose the legacy value to the migration path). Planner picks the
  mechanism; the constraint is non-negotiable.
- **D-14 (source in both files):** `state.json` KEEPS its recorded `source` alongside
  config's desired `source`. Config source = desired intent (sole authority); state source =
  materialized record (machine fact). The reconcile planner compares them; mismatch =>
  re-add. The SPLIT-02 architecture test must sanction `source` in STATE_SCHEMA as a
  materialized record -- do not read SPLIT-01's "live only in config" as forbidding it.

### Trichotomy & load-seam shape
- **D-15 (load seam):** `loadConfig` returns a discriminated result, not throw-plus-default:
  `{ status: "absent" } | { status: "invalid"; error } | { status: "valid"; config }`.
  Exhaustive switch + `assertNever` at every consumer (NFR-7 convention). Migration keys off
  `absent`; invalid can never be mistaken for empty by a careless catch.
- **D-16 (dangling plugin reference):** A declared plugin whose marketplace is not visible
  anywhere is a VALID config -- it is a per-entry "can't load" soft-fail at reconcile time
  (reported, skipped), never a CFG-03 abort.
- **D-17 (cross-scope marketplace visibility, constrains Phase 53):** Plugin entries resolve
  their marketplace cross-scope, one-way, mirroring CMP-3
  (`orchestrators/plugin/shared.ts:203-222`): a project-config plugin entry resolves against
  project config first, then user config; a user-config plugin entry sees user marketplaces
  only. Note: today's CMP-3 fallback clones a marketplace container record into project
  state -- the reconcile planner must treat that container as declared-by-implication, not
  as installed-but-undeclared.
- **D-18 (one-invalid-file fallback -- deliberate user choice):** When exactly one of
  base/local in a scope is invalid and the other valid, the merged view falls back to the
  valid file with a warning, and reconcile runs FULL for that scope, prunes included (a
  local-only declared plugin is uninstalled while local is broken; fixing the file
  reinstalls on next load). The CFG-03 abort applies when a scope has NO valid view (its
  only existing file invalid, or both invalid). Scopes stay independent: an aborted scope
  never blocks the other scope's reconcile. The destructive edge of the fallback was
  explicitly surfaced and accepted.
- **D-19 (messaging consistency):** All user-visible success/error messaging for config
  load/validation/fallback flows through the same structured-notify system as every other
  operation: `shared/notify.ts` / `emitWithSummary`, catalog-conformant subject-first row
  grammar, GRAM-01..05 summary-line discipline, closed-set REASONS. Any new status/reason
  tokens land with `docs/output-catalog.md` + catalog-uat byte fixtures in the same atomic
  commit (v1.3 atomic-supersession lesson). Phase 51 itself surfaces little (seams only);
  this binds Phases 52/55/56 emission contexts.

### Claude's Discretion
- Internal API split between `loadConfig` (per-file) and the merge step (`config-merge.ts`
  producing `MergedConfig`), and whether merge provenance (which file an entry came from) is
  carried on `MergedConfig` for later write-back/diff use.
- Exact validation-error detail format inside the `invalid` arm (mirror
  `firstValidationErrorDetail` in state-io.ts).
- TypeScript naming (`ScopeConfig`, `MergedConfig`, `ConfigLoadResult`, etc.) and file
  placement following the research structure (`persistence/config-io.ts`,
  `persistence/config-merge.ts`, `locations.ts` additions).
- How the architecture test enforces the SPLIT-02 write-seam ownership (e.g., import-graph
  or call-site assertion style, following existing `tests/architecture/` patterns).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` -- CFG-01..04, SPLIT-01/02, MIG/RECON/WB/ENBL/DIFF definitions
  and the v1.12 Out of Scope table (locked decisions: entry-level override, strict JSON,
  load-time-only reconcile, Pi-native schema)
- `.planning/ROADMAP.md` -- Phase 51 goal + 5 success criteria; Phases 52-56 boundaries

### v1.12 research (read before planning)
- `.planning/research/SUMMARY.md` -- synthesis: zero new deps, config-io mirrors state-io,
  trichotomy/migration/write-back safety gates, phase-by-phase mapping
- `.planning/research/ARCHITECTURE.md` -- component placement (`persistence/config-io.ts`,
  `config-merge.ts`, `locations.ts` additions), state-split detail, build order
- `.planning/research/PITFALLS.md` -- Pitfall 1 (empty/missing/unparseable trichotomy),
  Pitfall 2 (migration one-way door), Pitfall 9 (merge semantics), Pitfall 10 (schema
  evolution)

### Codebase templates (mirror these patterns)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` -- STATE_SCHEMA + Compile
  validator + loadState/saveState; the direct template for config-io.ts; also the file
  losing the `autoupdate` field (D-12)
- `extensions/pi-claude-marketplace/persistence/locations.ts` -- ScopedLocations brand;
  gains `configJsonPath` + `configLocalJsonPath` under `scopeRoot` (sibling tier of
  `agents/`, `mcp.json`)
- `extensions/pi-claude-marketplace/persistence/migrate.ts` -- legacy-migration +
  fire-and-forget persist pattern reused for the autoupdate scrub (D-12/D-13)
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` -- the NFR-1 atomic write seam
  `saveConfig` must route through
- `extensions/pi-claude-marketplace/domain/source.ts` -- `parsePluginSource` /
  `pathSource` / `githubSource` funnel that classifies config source strings (D-02)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (lines ~200-240) --
  CMP-3 one-way project->user marketplace fallback that D-17 mirrors
- `extensions/pi-claude-marketplace/shared/path-safety.ts` -- `assertPathInside` for the
  NFR-10 containment extension to config paths

### Messaging contract (binds any user-visible output)
- `docs/messaging-style-guide.md` -- locked grammar, closed sets
- `docs/output-catalog.md` -- per-command byte forms; catalog-uat byte-equality gate
- `extensions/pi-claude-marketplace/shared/notify.ts` -- structured NotificationMessage +
  `emitWithSummary` seam (GRAM-01..05)

### Background
- `docs/prd/pi-claude-marketplace-prd.md` -- authoritative V1 spec (NFR catalog, PI-7 hash
  versions, SC-1 scopes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `STATE_SCHEMA` pattern (typebox `Type.Object` + `Compile` + `.Check`/`.Errors` +
  `firstValidationErrorDetail`): copy wholesale for `CONFIG_SCHEMA`.
- `atomicWriteJson` (`shared/atomic-json.ts`, write-file-atomic): the only sanctioned JSON
  write path (NFR-1); `saveConfig` wraps it like `saveState` does.
- `parsePluginSource` funnel (`domain/source.ts`): classifies the D-02 raw source strings;
  ST-6 already revalidates stored sources through the same factories on load.
- `migrateLegacyMarketplaceRecords` + `persistMigratedState` (`persistence/migrate.ts`):
  the in-place scrub mechanism for D-12.
- `locationsFor` (`persistence/locations.ts`): frozen branded bundle; add the two config
  paths as hard-coded-suffix joins on `scopeRoot` (no untrusted components).

### Established Patterns
- Discriminated unions over throw/catch for can't-misuse results (NFR-7 `installable`);
  D-15's `ConfigLoadResult` follows it; `assertNever` exhaustiveness at consumers.
- typebox objects accept additional properties by default -- D-09's lenient posture is the
  schema default; no `additionalProperties: false` anywhere.
- Architecture tests in `tests/architecture/` enforce structural invariants (single-seam
  gates, closed sets, convergence); SPLIT-02's write-ownership test joins them.
- Per-scope independence (D-10 ScopedLocations): user and project configs never merge with
  each other; only base+local merge within a scope. Cross-scope is visibility (D-17), not
  merging.

### Integration Points
- `persistence/` gains `config-io.ts` and `config-merge.ts` as siblings of `state-io.ts`.
- `locations.ts` gains `configJsonPath` / `configLocalJsonPath` (scopeRoot tier).
- NFR-10 containment allow-list extends to the two config paths.
- Nothing in Phase 51 wires into `index.ts`, orchestrators, or notify emission -- those are
  Phases 52-56. Phase 51 is pure-addition shapes + the state-io field carve-out.

</code_context>

<specifics>
## Specific Ideas

- Minimal hand-authored config should look like:
  `{ "marketplaces": { "acme-tools": { "source": "acme/claude-tools" } }, "plugins": { "code-reviewer@acme-tools": {} } }`
  -- defaults fill in autoupdate=false, enabled=true.
- The user explicitly reversed an initial strict-unknown-keys choice to lenient (D-09) and
  explicitly accepted the destructive edge of the one-invalid-file fallback (D-18) after the
  consequences were spelled out -- do not re-litigate either downstream.

</specifics>

<deferred>
## Deferred Ideas

- Version pins with teeth (enforced/range pins, update policy in the committed file) --
  CFGV2-01, v2 backlog (reaffirmed by D-06).
- Boolean plugin shorthand (`"plugin@mp": true`) -- considered for file-shape ergonomics,
  rejected for v1.12 (schema union + write-back ambiguity); could revisit with CFGV2-*.
- Mass-prune sanity guard for typo'd/empty-looking configs -- not schema-level (D-05);
  belongs to the reconcile phases (53/55) if pursued (research Pitfall 1's empty-prune
  threshold).

</deferred>

---

*Phase: 51-Config Schema, Persistence & State Split*
*Context gathered: 2026-06-09*
