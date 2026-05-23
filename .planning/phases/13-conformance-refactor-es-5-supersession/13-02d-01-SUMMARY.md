---
phase: 13-conformance-refactor-es-5-supersession
plan: 02d-01
subsystem: plugin-list
tags:
  [
    plugin-list,
    plugin-list-row,
    plugin-list-payload,
    marketplace-row,
    empty-token,
    orphan-fold,
    adoption,
    list-orchestrator,
    soft-dep-per-row,
    truncate-col-66,
    cross-scope-state-read,
    MSG-PL-1,
    MSG-PL-4,
    MSG-PL-6,
    MSG-GR-3,
    MSG-SD-1,
    MSG-SD-2,
    CMC-03,
    CMC-06,
    CMC-09,
    CMC-13,
    CMC-21,
    CMC-22,
  ]

# Dependency graph
requires:
  - phase: 13-conformance-refactor-es-5-supersession
    provides: |
      Wave 1 keystone primitives from Plans 13-01-01, 13-01-02,
      13-01-03 + Wave 2 sub-waves 2a / 2b / 2c production patterns:
      - RowSpec discriminated union (MarketplaceRow, PluginListRow,
        EmptyToken, SoftDepProbe) + renderRow grammar composer
        (presentation/compact-line.ts) with MSG-PL-4 / MSG-PL-6 /
        MSG-IC-1..3 / MSG-SD-1..3 structurally enforced.
      - compareByNameThenScope comparator for MSG-GR-3 sort
        (presentation/sort.ts).
      - softDepStatus(pi) probe constructor; SoftDepProbe interface
        re-exported via compact-line.ts (platform/pi-api.ts).
      - REASONS 25-entry closed set + STATUS_TOKENS 15-entry closed
        set (shared/grammar/) -- unchanged by this plan.
      - notifyError auto-appends the MSG-CC-1 cause-chain trailer
        (D-CMC-12 -- inherited; the failed-marketplace header
        emitted by this orchestrator carries its own indented
        `cause:` trailer per CMC-22 catalog form, NOT via
        notifyError).
      - BLOCK E ESLint legacy-marker gates + no-legacy-markers.test.ts
        static audit -- unchanged by this plan.
      - Sub-wave 2c precedent: orchestrator owns MSG-GR-3 sort
        (D-13-19); renderer is a pure formatter that may apply a
        defensive secondary sort.

provides:
  - "presentation/plugin-list.ts rewritten on top of MarketplaceRow +
    PluginListRow + EmptyToken consumed via renderRow (CMC-22 /
    CMC-06). Legacy PluginRenderStatus and PluginListEntry types
    RETIRED. New PluginListPayload shape: `marketplaceBlocks` of
    `PluginListMarketplaceBlock` (header + plugin rows + optional
    causeTrailer). Empty case emits bare `(no plugins)` EmptyToken
    (CMC-10 / MSG-ER-1). Per-marketplace empty (zero plugins) emits
    indented `(no plugins)`. truncateColumn66 stays list-private
    (MSG-PL-1) and slices to budget-1 + U+2026 horizontal ellipsis
    per the catalog binding (was V1 `...` -- corrected to `…`).
    Unparseable marketplaces render `(failed) {unparseable}` header
    with indented `cause:` trailer per CMC-22 catalog lines 228-235."

  - "orchestrators/plugin/list.ts now reads BOTH scopes' state
    regardless of opts.scope (D-13-19). Implements the orphan-fold
    rule (D-13-17): when the PROJECT-scope marketplace record is a
    CLONE of the USER-scope record (same `marketplaceRoot`), the
    project-scope block is NOT emitted separately and its plugins
    fold under the user-scope header. Each folded plugin row carries
    its ACTUAL install scope (D-13-18: `[project]` bracket). Same-
    name marketplaces added INDEPENDENTLY in both scopes (each with
    its own `marketplaceRoot`) render as two separate per-scope
    blocks. Per-row `declaresAgents` / `declaresMcp` predicates feed
    renderRow's SoftDepProbe-driven `{requires pi-subagents}` /
    `{requires pi-mcp}` injection (CMC-13 / MSG-SD-1..3). MSG-GR-3 /
    CMC-03 sort applied at the orchestrator boundary
    (compareByNameThenScope) per D-13-19 / sub-wave 2c precedent."

  - "Cross-scope available-bucket exclusion: when the user-scope
    block folds orphan project-scope plugins, the user-scope
    manifest's available enumeration skips names already in the
    folded set so the catalog form at lines 205-213 is preserved
    (single `● alpha [project] (installed)` row -- no duplicate
    `○ alpha (available)`)."

  - "edge/handlers/plugin/list.ts: `makeListHandler(pi)` factory
    shape; `pi` is now closed-over and forwarded to listPlugins for
    SoftDepProbe construction. Wire-up updated in edge/register.ts."

  - "edge/handlers/tools.ts: re-projected onto the new
    PluginListPayload.marketplaceBlocks shape; takes pi from ctx.pi
    for the orchestrator call. The LLM-tool surface keeps its
    stable `[installed]` / `[available]` / `[unavailable]` line
    shape; the new RowSpec's `(upgradable)` maps to `[installed]`
    (MSG-PL-4 list-only)."

  - "tests/integration/fold-adoption.test.ts (NEW): CMC-21 / D-13-17
    round-trip test exercising real orchestrators (addMarketplace +
    installPlugin + listPlugins). Phase 1 asserts the orphan-fold
    form: project plugin installed from user-scope marketplace folds
    under the user-scope header. Phase 2 covers the independent-add
    path (workaround for the documented same-name semantic gap --
    see Decision 5 below)."

affects:
  - "13-03-01 (Wave 3 catalog UAT for `/claude:plugin list`) -- this
    plan's output is the catalog-conformance verification target for
    every CMC-22 rendered state."

  - "13-03-02 (Wave 3 ES-5 atomic commit) -- this sub-wave was the
    LAST Wave 2 sub-wave; every per-command surface now emits via
    the Wave 1 primitives. The cutover gate (Wave 3 plan #1 catalog
    UAT) becomes the binding verification before the legacy marker
    deletion lands."

# Tech tracking
tech-stack:
  added: [] # No new dependencies.
  patterns:
    - "Cross-scope state read at orchestrator boundary
      (orchestrators/plugin/list.ts): `Promise.all([loadState(user
      .extensionRoot), loadState(project.extensionRoot)])` runs in
      parallel. The fold rule needs visibility into BOTH scopes
      regardless of `opts.scope`; SC-6 scope narrowing happens
      AFTER block construction by filtering on emitScope."

    - "Marketplace-clone detection via `marketplaceRoot` equality
      (`isCloneOfUserMarketplace`): the install orchestrator's
      `cloneMarketplaceRecordForTargetScope` copies the user-scope
      `marketplaceRoot` verbatim into the project-scope record, so
      identity by path is the canonical clone signal. An
      independently-added project-scope marketplace has its OWN
      `marketplaceRoot` and the detector returns false -- both
      blocks render."

    - "Per-row declares-* predicates derived from state at
      orchestrator time: for INSTALLED plugins,
      `record.resources.{agents,mcpServers}.length > 0`. For
      AVAILABLE plugins, `resolved.componentPaths.agents.length > 0`
      and `Object.keys(resolved.mcpServers).length > 0`. The
      renderer's `composeReasons` consumes these predicates with
      the injected SoftDepProbe to emit `{requires pi-subagents}` /
      `{requires pi-mcp}` reasons when (declares AND
      companion-unloaded) per MSG-SD-1..2."

    - "Available-bucket exclusion via `excludeFromAvailable` set:
      `enumerateMarketplacePlugins` accepts an optional set of
      plugin names to skip when emitting `(available)` rows from
      the manifest. The user-scope block's caller passes the
      folded-orphan names so the manifest's `alpha` entry does NOT
      bucket as `(available)` under the user-scope header when an
      `alpha [project] (installed)` row is already folded there
      (preserves the catalog form at lines 205-213)."

    - "Unparseable-manifest CMC-22 form: the orchestrator detects
      load failure via `loadMarketplaceManifestSoftly` (try/catch
      wrapper); on failure it constructs a `MarketplaceRow` with
      `outcomeClass: 'failure'`, `status: 'failed'`, `reasons:
      ['unparseable']` and the block carries the error message as
      `causeTrailer`. The renderer emits the indented
      `  cause: <message>` line 2 spaces under the failed header
      per catalog lines 228-235. Replaces the V1 `[warning] ...`
      top-of-output line form."

    - "MSG-PL-1 column-66 truncation correction: the V1 helper used
      `...` (three ASCII periods) as the truncation suffix. The
      catalog binding form is `…` (U+2026 horizontal ellipsis,
      single character). The new truncateColumn66 slices to
      MAX_LINE_COLUMN-1 (65) + `…` so the rendered description
      lands exactly at column 66 with the catalog-binding glyph."

    - "Orchestrator-owned sort with defensive renderer secondary
      sort: `loadPluginListPayload` sorts marketplace blocks AND
      plugins-within-blocks via `compareByNameThenScope` before
      returning the payload. The renderer applies a defensive
      secondary sort using the same comparator -- both produce
      identical orderings, but the orchestrator-side sort is the
      canonical contract per D-13-19 (sub-wave 2c precedent at
      marketplace-list.ts established this pattern)."

key-files:
  created:
    - "tests/integration/fold-adoption.test.ts (Task 3: CMC-21 /
      D-13-17 round-trip integration -- 2 test cases covering the
      orphan fold + the independent-add adoption invariant)"

  modified:
    - "extensions/pi-claude-marketplace/presentation/plugin-list.ts (Task 1: full rewrite on MarketplaceRow + PluginListRow + EmptyToken + compareByNameThenScope; legacy PluginRenderStatus / PluginListEntry retired; truncateColumn66 corrected to U+2026 suffix)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts (Task 2: cross-scope state read + orphan-fold via marketplaceRoot identity + per-row declares-* predicates + excludeFromAvailable for fold orphans + MSG-GR-3 / CMC-03 sort)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts (Task 1 wiring: makeListHandler(pi) factory shape; threaded into edge/register.ts)"
    - "extensions/pi-claude-marketplace/edge/handlers/tools.ts (Task 1 wiring: re-projected onto new PluginListPayload.marketplaceBlocks shape; pi forwarded to loadPluginListPayload)"
    - "extensions/pi-claude-marketplace/edge/register.ts (Task 1 wiring: `list: makeListHandler(pi)`)"
    - "tests/presentation/plugin-list.test.ts (Task 1 TDD: 13 cases covering the new payload contract -- empty, single mixed, both scopes, soft-dep markers, upgradable icon, MSG-PL-6 carve-out, unparseable mp, zero-plugin mp, multi-mp sort, orphan fold, MSG-PL-1 truncation boundary)"
    - "tests/orchestrators/plugin/list.test.ts (Task 2 TDD: 18 cases migrated to the new compact-line shape -- PL-1 / PL-3 / PL-5 / PL-6 / PL-7 plus CMC-21 independent same-name marketplaces, SC-6 cross-scope walk, source-grep defense-in-depth)"
    - "tests/edge/handlers/plugin/list.test.ts (Task 1 wiring: makeListHandler(STUB_PI) factory; empty case asserted as bare `(no plugins)` EmptyToken)"

key-decisions:
  - "Marketplace-clone detection by `marketplaceRoot` equality.
    `cloneMarketplaceRecordForTargetScope` in
    orchestrators/plugin/shared.ts copies the user-scope record's
    marketplaceRoot verbatim into the project-scope record, so
    identity by on-disk path is the canonical clone signal. An
    independently-added project-scope marketplace has its OWN
    marketplaceRoot (a different on-disk fixture) and the detector
    returns false -- triggering the two-block render form per the
    catalog at lines 196-201."

  - "Available-bucket exclusion for folded orphans (Rule 1 bug
    fix, surfaced during phase 2 integration test). When the
    user-scope block folds orphan project-scope plugins, the
    user-scope manifest's available-bucket enumeration was emitting
    duplicate `○ alpha (available)` rows alongside the folded
    `● alpha [project] (installed)` row. The catalog at lines
    205-213 shows a SINGLE row per plugin. Fix:
    `enumerateMarketplacePlugins` accepts an `excludeFromAvailable`
    set; `buildMarketplaceBlock` forwards it; the user-scope path
    populates it from the folded plugins' names (filtered to
    installed/upgradable status). The exclusion preserves the
    catalog form. Tested in tests/integration/fold-adoption.test.ts
    phase 2."

  - "MSG-PL-1 column-66 truncation glyph corrected: V1 used `...`
    (three ASCII periods, 3 chars) for the truncation suffix; the
    catalog binding form at line 179 is `…` (U+2026 horizontal
    ellipsis, single character). The new truncateColumn66 slices
    to MAX_LINE_COLUMN-1 (65) + `…` so the rendered description
    lands exactly at column 66 with the catalog-binding glyph.
    Wave 3 catalog UAT will verify byte-equality."

  - "Unparseable-manifest emission as CMC-22 MarketplaceRow header
    rather than V1's `[warning] <reason>` top-of-output line. The
    catalog at lines 228-235 shows a `(failed) {unparseable}`
    marketplace header sitting alphabetically among the other
    marketplace blocks with an indented `cause: <text>` trailer
    underneath. The orchestrator surfaces this via the
    `PluginListMarketplaceBlock.causeTrailer` field; the renderer
    emits the indented `  cause: <text>` line 2 spaces under the
    header. PR-IL-6 / V1's `[warning]` top-of-output line form is
    RETIRED."

  - "Adoption-via-same-name semantic gap (documented + worked
    around in the integration test). The plan/catalog describes
    'adoption' as the user running `marketplace add --scope project
    official` while the project state already carries a CLONED
    `official` record from cross-scope install. In real conditions
    `addMarketplace` throws `MarketplaceDuplicateNameError` (the
    name is already taken in project state -- the cloned record
    blocks it). The architecturally equivalent contract that
    exercises the adoption invariant -- 'the renderer reflects
    whatever marketplace records exist; no state mutation in
    marketplace-add is required' -- uses a different-named
    marketplace in project scope (the integration test phase 2
    pattern). The same-name flow needs an explicit `marketplace
    remove --scope project` first (which the catalog doesn't show)
    or a different name. Documented in the test header as a
    discovered semantic gap; Wave 3 catalog UAT will surface
    whether this is a binding gap worth fixing in the add
    orchestrator (e.g. by detecting and replacing cloned records
    when the source differs)."

  - "MSG-GR-3 / CMC-03 sort owned at the orchestrator boundary
    (D-13-19 / sub-wave 2c precedent). The plan's task 2
    acceptance criterion explicitly requires
    `compareByNameThenScope` to appear in
    `orchestrators/plugin/list.ts`. `loadPluginListPayload` now
    sorts marketplace blocks AND plugins-within-blocks before
    returning the payload; the renderer's defensive secondary sort
    stays in place. Both layers produce the same ordering."

  - "Edge handler factory shape change: `makeListHandler` now
    takes `pi: ExtensionAPI` and closes over it (matching the
    install / uninstall / update / reinstall handler precedent).
    The orchestrator constructs a `SoftDepProbe` via
    `softDepStatus(pi)` and forwards it to the renderer for
    per-row soft-dep marker emission. `edge/register.ts` updated
    to pass `pi` at construction time."

patterns-established:
  - "Pattern: Cross-scope state read for fold-rule visibility.
    Orchestrators that compute scope-aware fold rules read BOTH
    scopes' state via `Promise.all([loadState(user), loadState
    (project)])`, then narrow the EMITTED surface via `opts.scope`
    filtering at the end. The fold rule's correctness depends on
    visibility into the OTHER scope; SC-6 scope narrowing is
    purely a presentation concern that runs AFTER block
    construction."

  - "Pattern: Marketplace-clone detection via `marketplaceRoot`
    identity. The plugin install orchestrator's
    `cloneMarketplaceRecordForTargetScope` produces a project-scope
    record with the SAME `marketplaceRoot` as the user-scope source
    record. Downstream surfaces that need to distinguish a cloned
    record from an independently-added record can use `path
    equality` as the canonical signal. (Future: if the install
    orchestrator changes how clones are recorded, this detector
    must follow.)"

  - "Pattern: Available-bucket exclusion for folded orphans.
    Enumeration helpers that bucket manifest entries as
    `(available)` / `(unavailable)` accept an optional
    `excludeFromAvailable` set of plugin names to skip. Callers
    that compose blocks with folded children pass the folded
    plugin names so the available enumeration does not produce
    duplicate rows for the same plugin. Generalizable to any
    future cross-scope fold rule."

  - "Pattern: Unparseable-manifest as MarketplaceRow failure
    header + causeTrailer. CMC-22 surfaces per-marketplace
    soft-fail as a failure-class MarketplaceRow header
    (`outcomeClass: 'failure'`, `status: 'failed'`, `reasons:
    ['unparseable']`) with the error message in `causeTrailer`;
    the renderer indents the `  cause: <text>` line 2 spaces
    under the header. Replaces V1's `[warning] ...` top-of-output
    line form. The marketplace block's `plugins` is empty -- the
    failure replaces the per-plugin enumeration."

  - "Pattern: Orchestrator-owned sort with renderer defensive
    secondary sort. The orchestrator boundary owns MSG-GR-3 /
    CMC-03 sort via `compareByNameThenScope` (the renderer becomes
    a pure formatter per D-13-19). The renderer applies a
    defensive secondary sort that produces the same ordering --
    cheap insurance against the orchestrator forgetting to sort
    in a future refactor. Sub-wave 2c established this; sub-wave
    2d follows the same pattern."

requirements-completed:
  - CMC-03 # MSG-GR-3 sort applied at the orchestrator boundary; renderer applies defensive secondary sort
  - CMC-06 # Plugin row icon dispatched by status via PluginListRow + renderRow (MSG-IC-1..3)
  - CMC-09 # (upgradable) STRUCTURALLY constrained to PluginListRow only (Plan 13-01-01 Extract<> narrowing); list-only per MSG-PL-4
  - CMC-13 # Per-row soft-dep markers via declaresAgents / declaresMcp predicates derived from state at orchestrator time; renderer probes via SoftDepProbe
  - CMC-21 # Orphan fold + adoption invariant: project-scope plugin records cloned from user-scope marketplaces fold under the user-scope header; independent project-scope marketplace records render as separate blocks
  - CMC-22 # Catalog conformance for /claude:plugin list: marketplace header + indented plugin rows + indented description; unparseable manifest as failure header + indented cause trailer; zero-plugin marketplace block as indented (no plugins)

# Metrics
duration: 33min
completed: 2026-05-23
---

# Phase 13 Plan 02d-01: Wave 2 Sub-Wave 2d Plugin List Migration Summary

**The `/claude:plugin list` surface migrated to the Wave 1 keystone primitives. The renderer at `presentation/plugin-list.ts` is now a pure formatter over `PluginListPayload` (marketplace blocks of `MarketplaceRow` headers + `PluginListRow` children + optional `EmptyToken`); the orchestrator at `orchestrators/plugin/list.ts` reads BOTH scopes' state regardless of `opts.scope`, computes the orphan-fold per D-13-17..D-13-19, and constructs the payload with per-row `declaresAgents` / `declaresMcp` predicates for `SoftDepProbe`-driven `{requires pi-*}` injection. The unparseable-marketplace surface migrated from V1's `[warning] ...` top-of-output line form to CMC-22's `(failed) {unparseable}` MarketplaceRow header with indented `cause:` trailer. MSG-PL-1 column-66 truncation corrected from V1's `...` to the catalog-binding `…` (U+2026 horizontal ellipsis). The new integration test `tests/integration/fold-adoption.test.ts` exercises the orphan-fold + adoption invariant end-to-end using real orchestrators against a hermetic temp scope-root.**

**This was the LAST Wave 2 sub-wave.** Every per-command surface now emits via the Wave 1 primitives; the cutover gate is Wave 3 plan #1 (catalog UAT) which becomes the binding verification before the legacy marker deletion lands in Wave 3 plan #2.

## Performance

- **Duration:** ~33 minutes
- **Started:** 2026-05-23T20:46:41Z
- **Tasks:** 3 / 3 (Tasks 1 + 2 paired in a single commit per sub-wave 2c precedent because the renderer + orchestrator types are interdependent; Task 3 separate)
- **Files modified:** 5 production source files + 3 test files
- **Files created:** 1 test file (tests/integration/fold-adoption.test.ts)
- **Tests:** 1122 / 1122 passing (was 1120 before the plan -- net +2 reflects the 2 new fold-adoption integration test cases; the renderer + orchestrator test files were rewritten in place)

## Accomplishments

- **CMC-22 / CMC-06 plugin-list renderer rewrite (Task 1).** `presentation/plugin-list.ts` fully rewritten on top of the Wave 1 keystone primitives. Legacy `PluginRenderStatus` and `PluginListEntry` types RETIRED. New `PluginListPayload` shape: `marketplaceBlocks` of `PluginListMarketplaceBlock` (header + plugin rows + optional `causeTrailer`). Empty case emits bare `(no plugins)` EmptyToken (CMC-10 / MSG-ER-1). Per-marketplace empty (zero plugins) emits indented `(no plugins)`. Plugin rows sort within each block via `compareByNameThenScope` (project-before-user tie-break per MSG-GR-3). Description on a second 4-space indented line, truncated at column 66 with U+2026 (catalog binding -- V1 used `...` which was wrong).

- **CMC-09 / MSG-PL-4 `(upgradable)` list-only constraint inherited.** Plan 13-01-01 narrowed `PluginListRow.status` to `Extract<StatusToken, "installed" | "upgradable" | "available" | "unavailable">`; this plan consumes that narrowing. The orchestrator computes the (upgradable) status via PL-5 string compare (`manifest.version !== installed.version`); the renderer dispatches to the ● effective-state icon.

- **CMC-13 / MSG-SD-1..3 per-row soft-dep markers (Task 2).** The orchestrator derives `declaresAgents` / `declaresMcp` predicates from state at row-construction time: for INSTALLED rows, `record.resources.{agents,mcpServers}.length > 0`; for AVAILABLE rows, `resolved.componentPaths.agents.length > 0` and `Object.keys(resolved.mcpServers).length > 0`. The renderer's `composeReasons` consumes these predicates with the injected `SoftDepProbe` (constructed from `softDepStatus(pi)` at the orchestrator boundary) and emits `{requires pi-subagents}` / `{requires pi-mcp}` reasons when (declares AND companion-unloaded).

- **MSG-PL-6 scope-bracket carve-out structurally enforced.** `(available)` and `(unavailable)` rows OMIT the `[<scope>]` bracket per MSG-PL-6; structurally enforced inside `renderRow`'s `PluginListRow` variant by Plan 13-01-01. This plan does not need to handle the carve-out at the orchestrator -- the row data still carries `scope: <s>`, and the renderer suppresses the bracket on the matching status values.

- **CMC-21 / D-13-17 / D-13-19 orphan-fold rule (Task 2).** `orchestrators/plugin/list.ts` reads BOTH scopes' state regardless of `opts.scope` (the fold rule needs cross-scope visibility). The orchestrator detects PROJECT-scope records that are CLONES of USER-scope records via `marketplaceRoot` identity (the install orchestrator's `cloneMarketplaceRecordForTargetScope` copies this field verbatim); cloned project records are NOT emitted as separate blocks, and their plugins fold under the user-scope header. Each folded plugin row carries its ACTUAL install scope per D-13-18 (`[project]` bracket). Same-name marketplaces added INDEPENDENTLY in both scopes (each with its own `marketplaceRoot`) render as two separate per-scope blocks (catalog lines 196-201 form).

- **CMC-22 unparseable-manifest surface (Task 2).** Replaced V1's `[warning] ...` top-of-output line form with CMC-22's `(failed) {unparseable}` MarketplaceRow header sitting alphabetically among the other marketplace blocks, with an indented `cause: <text>` trailer. The orchestrator constructs the failure header via `makeFailedMarketplaceHeader` (`outcomeClass: "failure"`, `status: "failed"`, `reasons: ["unparseable"]`) and routes the error message through `PluginListMarketplaceBlock.causeTrailer`; the renderer emits `  cause: <text>` 2 spaces under the header.

- **CMC-21 / D-13-17 integration round-trip (Task 3).** `tests/integration/fold-adoption.test.ts` (NEW): two test cases using REAL orchestrators (addMarketplace + installPlugin + listPlugins) against a hermetic temp scope-root. Phase 1 asserts the orphan-fold form: project plugin installed from user-scope marketplace folds under the user-scope header. Phase 2 covers the independent-add path (documents the discovered same-name semantic gap and works around it).

- **Cross-scope available-bucket exclusion (Rule 1 bug fix, surfaced during Task 3).** When the user-scope block folds orphan project-scope plugins, the user-scope manifest's available-bucket enumeration was emitting duplicate `○ alpha (available)` rows alongside the folded `● alpha [project] (installed)` row. Fixed: `enumerateMarketplacePlugins` accepts an `excludeFromAvailable` set; the user-scope block builder populates it from the folded plugins' names. The catalog form at lines 205-213 (single row per plugin) is preserved.

- **Edge handlers + LLM tool migration (Task 1 wiring).** `edge/handlers/plugin/list.ts` migrated to the `makeListHandler(pi)` factory shape (matching the install / uninstall / update / reinstall handler precedent); `edge/register.ts` threads `pi` at construction time. `edge/handlers/tools.ts` re-projected onto the new `PluginListPayload.marketplaceBlocks` shape; the LLM-tool surface keeps its stable `[installed]` / `[available]` / `[unavailable]` line shape, with `(upgradable)` mapping to `[installed]` per MSG-PL-4 list-only.

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: rewrite renderer + migrate orchestrator (CMC-22 / CMC-06 / CMC-09 / CMC-13 / CMC-21 / CMC-03)** -- `fa0b8e5` (feat, TDD) -- paired per sub-wave 2c precedent because the renderer + orchestrator types are interdependent (renderer's `PluginListPayload` shape and the orchestrator's call shape must land together to keep the build green).
2. **Task 3: integration test + available-bucket exclusion (CMC-21 / D-13-17 / D-13-18 / D-13-19)** -- `fc5a75e` (test + Rule 1 deviation) -- the integration test surfaced a duplicate-row bug in the orchestrator's available-bucket enumeration when folding orphans; fix landed in the same commit alongside the test.
3. **Refactor: move CMC-03 sort to orchestrator boundary** -- `176d5a7` (refactor) -- satisfies the plan acceptance criterion `grep -c 'compareByNameThenScope' orchestrators/plugin/list.ts >= 1`; the renderer's defensive sort stays in place so both layers produce the same ordering.

## Files Created/Modified

See the `key-files.modified:` block in the frontmatter for the complete list and per-file purpose annotations. Highlights:

### Created

- `tests/integration/fold-adoption.test.ts` -- 2 integration test cases for the CMC-21 round-trip

### Modified (production)

- `extensions/pi-claude-marketplace/presentation/plugin-list.ts` -- full rewrite on Wave 1 primitives
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` -- cross-scope state read + orphan fold + per-row predicates + sort
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` -- `makeListHandler(pi)` factory shape
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` -- re-projected onto new payload shape
- `extensions/pi-claude-marketplace/edge/register.ts` -- wire `pi` into list handler factory

### Modified (test)

- `tests/presentation/plugin-list.test.ts` -- 13 cases for the new payload contract
- `tests/orchestrators/plugin/list.test.ts` -- 18 cases for the new compact-line shape
- `tests/edge/handlers/plugin/list.test.ts` -- 6 cases for the new factory shape + empty token

## Decisions Made

See the `key-decisions:` block in the frontmatter (7 entries documenting the architectural choices made during the migration). Briefest summary:

1. Marketplace-clone detection by `marketplaceRoot` identity (canonical signal from `cloneMarketplaceRecordForTargetScope`).
2. Available-bucket exclusion for folded orphans (Rule 1 bug fix, catalog-mandated).
3. MSG-PL-1 column-66 truncation glyph corrected from `...` to `…` (catalog binding).
4. Unparseable-manifest emission as CMC-22 MarketplaceRow failure header + causeTrailer (V1 `[warning]` form RETIRED).
5. Adoption-via-same-name semantic gap documented + worked around in the integration test.
6. MSG-GR-3 / CMC-03 sort owned at the orchestrator boundary per D-13-19 / sub-wave 2c precedent.
7. Edge handler factory shape change: `makeListHandler(pi)` matches the install / uninstall / update / reinstall precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate available-row when folding orphans**

- **Found during:** Task 3 integration test phase 1 (the assertion `out.includes("○ alpha v1.0.0 (available)") === false` failed because the user-scope manifest's available-bucket enumeration produced `○ alpha v1.0.0 (available)` alongside the folded `● alpha [project] v1.0.0 (installed)`).
- **Issue:** The catalog at lines 205-213 shows a SINGLE row per plugin when folding orphans -- the manifest's `alpha` entry should NOT bucket as `(available)` under the user-scope header when an `alpha [project] (installed)` row is already folded there.
- **Fix:** Added `excludeFromAvailable: ReadonlySet<string>` parameter to `enumerateMarketplacePlugins`; `buildMarketplaceBlock` forwards it; the user-scope block builder populates it from the folded plugins' names (filtered to `installed`/`upgradable` status). The exclusion preserves the catalog form.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`.
- **Commit:** `fc5a75e`.

**2. [Rule 1 - Bug] MSG-PL-1 truncation glyph wrong**

- **Found during:** Task 1 implementation (the V1 `truncateColumn66` helper used `...` -- three ASCII periods, 3 chars -- as the truncation suffix, slicing to column 63).
- **Issue:** The catalog at line 179 shows the truncation form using `…` (U+2026 horizontal ellipsis, single character) -- the correct glyph for column-66 truncation.
- **Fix:** New `truncateColumn66` slices to `MAX_LINE_COLUMN - 1` (65 chars) + `…` so the rendered description lands exactly at column 66 with the catalog-binding glyph.
- **Files modified:** `extensions/pi-claude-marketplace/presentation/plugin-list.ts`.
- **Commit:** `fa0b8e5` (rolled into Task 1).

**3. [Rule 3 - Tooling] ESLint import-x/order + Prettier auto-fixes**

- **Found during:** All three commits' pre-commit cycle.
- **Issue:** `import-x/order` flagged import position in the new `orchestrators/plugin/list.ts` imports of `compareByNameThenScope`; Prettier flagged minor formatting on several files.
- **Fix:** Ran `npx eslint --fix` + `npx prettier --write` on the changed files before each commit. No semantic changes.
- **Commits:** rolled into `fa0b8e5`, `fc5a75e`, `176d5a7`.

**4. [Rule 2 - Missing critical correctness primitive] Cross-scope available-bucket exclusion**

(Same root cause as Deviation 1; documented separately because the exclusion mechanism is a general-purpose primitive added to `enumerateMarketplacePlugins`'s signature, not just a one-off fix. Future fold rules that introduce cross-scope folding can reuse the `excludeFromAvailable` parameter.)

### Architectural Decisions Logged (Not Deviations)

**5. Adoption-via-same-name semantic gap discovered + worked around in the integration test.**

The plan's task 3 action paragraph (and the catalog at lines 205-213) describes "adoption" as the user running `marketplace add --scope project official` while the project state already carries a CLONED `official` record from cross-scope install. In real conditions `addMarketplace` throws `MarketplaceDuplicateNameError` at line 209 of `orchestrators/marketplace/add.ts` (the name is already taken in project state -- the cloned record blocks it). The architecturally equivalent contract that exercises the adoption invariant -- "the renderer reflects whatever marketplace records exist; no state mutation in marketplace-add is required" (D-13-17) -- uses a DIFFERENT-named marketplace in project scope. The integration test phase 2 uses `official-user` (user scope) and `official-project` (project scope, independent fixture) to demonstrate that the renderer surfaces both blocks. The same-name flow needs an explicit `marketplace remove --scope project` first OR `addMarketplace` would need to detect-and-replace cloned records when the new source differs. **Documented in the test header as a discovered semantic gap; Wave 3 catalog UAT will surface whether this is a binding gap worth fixing in the add orchestrator.**

**6. Tasks 1 + 2 committed together (sub-wave 2c precedent).**

The plan declares Task 1 (renderer) and Task 2 (orchestrator) as separate atomic-commit units, but each task's acceptance criteria require `npm run check` exits 0. The renderer's payload shape and the orchestrator's call shape are interdependent: rewriting the renderer alone breaks the orchestrator's typecheck; migrating the orchestrator alone has nothing to call. Sub-wave 2c's Task 1 paired the renderer rewrite + orchestrator migration in a single commit for the same reason. This plan follows that precedent: `fa0b8e5` carries both Tasks 1 + 2 together. The commit message cites both tasks and links them to the precedent.

### Authentication Gates

None. All operations were filesystem-local typecheck / test / lint flows; no network or auth surface was touched.

## Issues Encountered

- **Pre-commit `trufflehog` hook fails inside the worktree sandbox.** Known per project CLAUDE.md and the parent execute-plan agent's guidance. Worked around by prefixing each commit with `SKIP=trufflehog`. The underlying scan was confirmed clean by running `pre-commit run trufflehog --all-files` outside the commit cycle (succeeded with no findings prior to commit).

## TDD Gate Compliance

Tasks 1, 2, and 3 are marked `tdd="true"` in the plan frontmatter. Per the plan-level TDD gate semantics for `type: execute` plans, each task's commit lands the migration AND the corresponding test updates together (catalog-conformance is the binding contract; the test surface asserts byte-shape against the catalog forms). The cascade-rendering primitives themselves were TDD-tested in Plans 13-01-01 / 13-01-02 / 13-01-03. This sub-wave's tests are integration-level assertions on the orchestrator-emitted body strings + the renderer's pure transforms.

Task 1's renderer tests followed a strict RED -> GREEN sequence: the test file was rewritten first (matching the new shape), all tests failed against the V1 renderer, then the renderer was rewritten (all 13 cases pass). Task 3's integration test followed the same pattern: 2 cases written, phase 1 passed, phase 2 surfaced the duplicate-row bug, fix added, both cases pass.

## Threat Surface Scan

The plan's `<threat_model>` register identified 2 dispositions:

- **T-13-16 (Tampering -- fold rule + sort determinism):** mitigated structurally. `compareByNameThenScope` provides deterministic order; the integration test exercises the round-trip end-to-end. The orchestrator-side sort (added in commit `176d5a7`) is the canonical contract; the renderer's defensive secondary sort produces the same ordering.
- **T-13-17 (Information Disclosure -- plugin descriptions):** accepted. `description` comes from the user-trusted manifest; `truncateColumn66` truncates at column 66; no path leakage. The new U+2026 ellipsis glyph is a single Unicode code point with no side channels.

No new security-relevant surface introduced beyond what the threat register anticipated. No `threat_flag:` entries to record.

NFR-9 invariant inherited from earlier plans: the catastrophic error path in `listPlugins` uses `notifyError` which surfaces only `.message` via the cause-chain trailer composer.

## Known Stubs

None. Every migrated callsite renders via the Wave 1 primitives; no placeholder or "coming soon" branches were introduced. The orchestrator's `excludeFromAvailable` parameter has a documented default of `new Set()` for the case where no fold occurs -- this is the canonical "no exclusion" form, not a stub.

The integration test's phase 2 documents the same-name adoption semantic gap as a discovered architectural reality (the catalog/plan's flow throws `MarketplaceDuplicateNameError`); the test uses different-named marketplaces to exercise the adoption INVARIANT (the renderer surfaces whatever exists; no state mutation in marketplace-add is required). This is NOT a stub -- the underlying contract is verified; only the same-name flow needs a separate clean-up step (e.g. `marketplace remove --scope project` first) which is out of scope for this plan.

## Self-Check: PASSED

**Files verified to exist:**

- FOUND: extensions/pi-claude-marketplace/presentation/plugin-list.ts (modified)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts (modified)
- FOUND: extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts (modified)
- FOUND: extensions/pi-claude-marketplace/edge/handlers/tools.ts (modified)
- FOUND: extensions/pi-claude-marketplace/edge/register.ts (modified)
- FOUND: tests/presentation/plugin-list.test.ts (modified)
- FOUND: tests/orchestrators/plugin/list.test.ts (modified)
- FOUND: tests/edge/handlers/plugin/list.test.ts (modified)
- FOUND: tests/integration/fold-adoption.test.ts (created)
- FOUND: .planning/phases/13-conformance-refactor-es-5-supersession/13-02d-01-SUMMARY.md (this file)

**Commits verified to exist:**

- FOUND: fa0b8e5 (Tasks 1 + 2 plugin list renderer + orchestrator migration)
- FOUND: fc5a75e (Task 3 fold-adoption integration test + Rule 1 available-bucket exclusion fix)
- FOUND: 176d5a7 (refactor: CMC-03 sort to orchestrator boundary)

**Overall verification:**

- FOUND: `npm run check` exits 0 (1122 / 1122 tests pass; typecheck + lint + format clean)
- FOUND: `node --test tests/integration/fold-adoption.test.ts` exits 0 (2 / 2 cases pass)
- FOUND: `node --test tests/presentation/plugin-list.test.ts` exits 0 (13 / 13 cases pass)
- FOUND: `node --test tests/architecture/no-legacy-markers.test.ts` exits 0
- FOUND: `grep -c 'renderRow' extensions/pi-claude-marketplace/presentation/plugin-list.ts` returns 10 (>= 1 required)
- FOUND: `grep -c 'PluginRenderStatus' extensions/pi-claude-marketplace/presentation/plugin-list.ts` returns 0 (legacy literal-union retired)
- FOUND: `grep -c 'truncateColumn66' extensions/pi-claude-marketplace/presentation/plugin-list.ts` returns 2 (MSG-PL-1 list-only column-66 preserved)
- FOUND: `grep -c 'compareByNameThenScope' extensions/pi-claude-marketplace/presentation/plugin-list.ts` returns 6 (MSG-GR-3 sort applied at renderer + at orchestrator)
- FOUND: `grep -c 'PluginListPayload\|PluginListMarketplaceBlock' extensions/pi-claude-marketplace/presentation/plugin-list.ts` returns 5 (payload contract defined for orchestrator consumer)
- FOUND: `grep -c 'MAX_LINE_COLUMN = 66' extensions/pi-claude-marketplace/presentation/plugin-list.ts` returns 1
- FOUND: `grep -c 'loadState' extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` returns 3 (BOTH user + project scope state reads per D-13-19)
- FOUND: `grep -c 'PluginListPayload\|PluginListMarketplaceBlock' extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` returns 9 (orchestrator constructs the payload per D-13-19)
- FOUND: `grep -c 'declaresAgents\|declaresMcp' extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` returns 16 (D-13-07 per-row soft-dep predicates computed)
- FOUND: `grep -c 'compareByNameThenScope' extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` returns 5 (MSG-GR-3 / CMC-03 sort applied at orchestrator)
- FOUND: `grep -c 'softDepStatus' extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` returns 4
- FOUND: `grep -c 'CMC-21' tests/integration/fold-adoption.test.ts` returns 6
- FOUND: `grep -c 'D-13-17' tests/integration/fold-adoption.test.ts` returns 9
- FOUND: `grep -c 'addMarketplace\|listPlugins\|installPlugin' tests/integration/fold-adoption.test.ts` returns 23 (real orchestrators invoked)
- FOUND: Every Task acceptance criterion gate green

______________________________________________________________________

_Phase: 13-conformance-refactor-es-5-supersession_
_Plan: 02d-01_
_Completed: 2026-05-23_
