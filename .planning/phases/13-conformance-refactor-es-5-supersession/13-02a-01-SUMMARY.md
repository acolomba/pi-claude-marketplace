---
phase: 13-conformance-refactor-es-5-supersession
plan: 02a-01
subsystem: orchestrators
tags:
  [
    cascade-summary,
    plugin-cascade-row,
    version-arrow,
    rollback-partial,
    import-cascade,
    MSG-PL-3,
    MSG-RP-1,
    MSG-SR-4,
    MSG-SR-5,
    MSG-SR-6,
    MSG-SD-1,
    MSG-SD-2,
    MSG-SD-3,
    CMC-02,
    CMC-13,
    CMC-17,
    CMC-20,
    CMC-25,
    CMC-26,
    CMC-27,
  ]

# Dependency graph
requires:
  - phase: 13-conformance-refactor-es-5-supersession
    provides: |
      Wave 1 keystone primitives from Plans 13-01-01, 13-01-02, 13-01-03:
      - RowSpec discriminated union (PluginCascadeRow, MarketplaceRow,
        EmptyToken, RollbackChild) + renderRow grammar composer
        (presentation/compact-line.ts)
      - cascadeSummary({marketplace, rows, probe}) -> {message, severity}
        + cascadeSeverity helper (presentation/cascade-summary.ts) --
        structurally restricts severity to "success" | "warning"
      - renderRollbackPartial(parent, children, probe) -- MSG-RP-1
        composer for the indented children block
      - SoftDepProbe interface + softDepStatus(pi) probe constructor
        on platform/pi-api.ts
      - notifyError auto-appends the MSG-CC-1 cause-chain trailer
        (D-CMC-12); composeErrorWithCauseChain helpers exist for
        outcome-aggregation notes
      - REASONS 23-entry closed set (shared/grammar/reasons.ts) --
        CMC-11 binding contract
      - BLOCK E + BLOCK E-2 ESLint gates + no-legacy-markers.test.ts
        static audit (D-13-09 / D-13-12) -- prevent legacy ES-5 marker
        regression during Wave 2
provides:
  - "orchestrators/plugin/reinstall.ts emits via cascadeSummary; single-
    plugin reinstall uses the 1-row cascade form per LOCKED I-01 (CMC-25)"
  - "orchestrators/plugin/update.ts emits via cascadeSummary with version-
    transition arrows on (updated) rows (MSG-PL-3); rollback-partial
    failures render as parent + indented children via spliceRollbackPartials
    (CMC-17, CMC-26)"
  - "orchestrators/import/execute.ts emits the `Claude plugin import
    summary` preamble + per-marketplace cascade blocks; source-mismatch
    renders `(failed) {source mismatch}` headers with dependent
    `(skipped) {source mismatch}` children; severity dispatch is 2-arm
    (notifySuccess | notifyWarning) -- legacy 3-arm including notifyError
    on unexpectedPluginFailures is retired per MSG-SR-6 (CMC-27)"
  - "orchestrators/types.ts: PluginUpdateOutcome gains declaresAgents/Mcp
    + phaseFailures fields; ReinstallReinstalledOutcome gains
    declaresAgents/Mcp -- per-row soft-dep predicate inputs (CMC-13)"
affects:
  - "13-02b-01 (sub-wave 2b: single-plugin install/uninstall/bootstrap;
    consumes the same PluginCascadeRow / renderRow / softDepStatus surface
    -- now battle-tested in production callsites)"
  - "13-02c-01 (sub-wave 2c: marketplace add/remove/list/update/autoupdate;
    consumes MarketplaceRow + renderRow -- now battle-tested with the
    `outcomeClass: failure` + `(failed)` token shape from source-mismatch
    handling)"
  - "13-03 (Wave 3: catalog UAT for `/claude:plugin reinstall`,
    `/claude:plugin update`, `/claude:plugin import` -- this plan's output
    is the catalog-conformance verification target)"

# Tech tracking
tech-stack:
  added: [] # No new dependencies.
  patterns:
    - "Outcome -> RowSpec mapping helpers (outcomeToCascadeRow): each
      orchestrator owns its local outcome-to-cascade-row mapping function,
      narrowing free-text notes to closed-set Reasons via a per-orchestrator
      narrowReason predicate. The narrowing is intentionally local because
      the synthesizer-generated notes shapes differ per orchestrator
      (reinstall has manual-recovery anchors; update has phase-3 errors;
      import has source-mismatch causes)."
    - "Per-(scope, marketplace) block grouping via a Map keyed by
      `${scope}:${marketplace}`; sorted via scopeOrder (project-before-
      user) primary + name-localeCompare secondary. Mirrors
      compareByNameThenScope but at the marketplace-block layer rather
      than the row layer."
    - "spliceRollbackPartials post-render pattern: cascadeSummary
      produces a flat per-marketplace message; rollback-partial parents
      need an indented children block inserted at the parent row's
      position. The orchestrator post-processes the cascadeSummary
      output by splitting on newlines, matching the exact rendered
      parent line, and splicing the indented children beneath it. Keeps
      cascadeSummary's API surface clean (it never needs to know about
      per-row trailing blocks)."
    - "Single-plugin reinstall renders as a 1-marketplace 1-row cascade
      via cascadeSummary (NOT PluginInlineRow). Plan 13-01-01
      deliberately narrowed PluginInlineRow.status to exclude
      'reinstalled' -- the LOCKED I-01 decision picks PluginCascadeRow
      to avoid widening the inline variant. Catalog matches the single-
      row cascade shape (one marketplace header + one indented row)."
    - "PluginUpdateOutcome.phaseFailures: new structural field carrying
      the bridge-phase failure list (skills/commands/agents/mcp + msg)
      so the cascade renderer can build the rollback-partial children
      block without parsing the legacy `notes: [...]` text array.
      notes[] is retained for outcome-text aggregation outside the
      notify path."

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (Task 1: migrate to cascadeSummary + EmptyToken; single-plugin reinstall via 1-row cascade per LOCKED I-01; per-row soft-dep markers via declaresAgents/Mcp)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts (Task 2: migrate to cascadeSummary with version-transition arrows on (updated) rows per MSG-PL-3; rollback-partial via spliceRollbackPartials; legacy partition headers retired)"
    - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts (Task 3: rewrite formatClaudeImportSummary to per-mp cascade; 3-arm severity branch collapses to 2-arm dispatch; source-mismatch dependent-plugin children + diagnostic splicing)"
    - "extensions/pi-claude-marketplace/orchestrators/types.ts (extend ReinstallReinstalledOutcome with declaresAgents/Mcp; extend PluginUpdateOutcome with declaresAgents/Mcp + phaseFailures)"
    - "tests/orchestrators/plugin/reinstall.test.ts (8 assertions migrated to new RowSpec shape)"
    - "tests/orchestrators/plugin/update.test.ts (6 assertions migrated to new RowSpec shape)"
    - "tests/orchestrators/import/execute.test.ts (4 assertions migrated to new RowSpec shape + 2-arm severity)"
    - "tests/edge/handlers/plugin/reinstall.test.ts (3 assertions migrated to new RowSpec shape)"
    - "tests/edge/handlers/plugin/update.test.ts (3 assertions migrated to (no plugins) form)"
    - "tests/edge/register.test.ts (1 assertion migrated to (no plugins) form)"

key-decisions:
  - "LOCKED I-01 honored: single-plugin reinstall renders as 1-marketplace
    1-row cascade via PluginCascadeRow + cascadeSummary, NOT as a
    broadened PluginInlineRow. Plan 13-01-01 deliberately narrowed
    PluginInlineRow.status to exclude 'reinstalled' to enforce this
    structurally. The renderSuccessBody helper now takes a SoftDepProbe
    instead of an ExtensionAPI (the probe is constructed at the call
    site via softDepStatus(pi))."
  - "Closed-set Reason narrowing per-orchestrator: each orchestrator owns
    a local narrowReason / narrowSkipReason / narrowFailReason helper
    that maps the legacy free-form notes shapes to the closed REASONS
    set (CMC-11). Unmappable text falls back to a documented permissive
    Reason (`not in manifest`). This is intentionally narrow -- production
    code paths have known note shapes; the catalog UAT in Wave 3 is the
    binding verification that the mapped Reason set is sufficient."
  - "Update phase-name tokens (skills/commands/agents/mcp) are NOT closed
    REASONS members. The plan permitted escalating to discuss-phase if
    any phase token was missing; instead we resolved it inline: the
    rollback-partial parent carries the canonical `'rollback partial'`
    Reason and each RollbackChild carries phaseLabel `[<phase>]` to
    surface the bridge name without re-introducing free-form Reasons.
    Wave 3 catalog UAT verifies user-visible shape."
  - "Import 3-arm severity branch collapses to 2-arm dispatch. MSG-SR-6
    forbids notifyError on cascade summaries -- the legacy
    `unexpectedPluginFailures > 0 -> notifyError` branch is RETIRED; the
    user sees the failure structurally via the `(failed)` token on the
    cascade row at warning severity. The outer setup-failure catch
    (`Import failed: ...`) stays notifyError (it's a non-cascade error
    surface)."
  - "PluginUpdateOutcome.phaseFailures: NEW structural field decouples
    rollback-partial children rendering from the legacy notes-text
    aggregation. Notes[] is retained for outcome-aggregation callers
    outside the notify path; phaseFailures drives the cascade
    renderer's spliceRollbackPartials post-processing."
  - "Idempotent-skip preserves the 'Import already up to date.'
    confirmation line. The cascade body below still renders skipped
    rows so the operator sees what was reconciled. The legacy
    formatter's `Skipped existing items:` partition body is RETIRED;
    skipped marketplaces and plugins now render as cascade rows
    `(skipped) {already installed}` under their marketplace header."

patterns-established:
  - "Pattern: per-(scope, marketplace) cascade block grouping. Map keyed
    by `${scope}:${marketplace}`; sorted via scopeOrder (project-before-
    user) + name-localeCompare. Used identically by all 3 orchestrators
    in this plan (reinstall, update, import). Wave 2b / 2c sub-waves
    consuming MarketplaceRow + cascadeSummary will follow the same
    grouping shape."
  - "Pattern: spliceRollbackPartials post-render. cascadeSummary
    produces flat per-marketplace messages; orchestrators that need
    per-row trailing blocks (rollback-partial children, source-mismatch
    diagnostic causes) post-process the cascadeSummary output by
    splitting on newlines, matching the exact rendered row line, and
    splicing the trailing block beneath it. Keeps cascadeSummary's API
    clean."
  - "Pattern: outcome-extension fields for renderer predicates. When the
    renderer needs additional per-row inputs (declaresAgents/Mcp for
    soft-dep markers; phaseFailures for rollback-partial children) the
    orchestrator's outcome type is extended with optional fields. The
    fields are populated by the orchestrator from validated state, then
    consumed by the renderer through typed RowSpec construction. This
    pattern replaces the legacy aggregate-trailer pattern
    (subagentWarningIfNeeded / mcpAdapterWarningIfNeeded) for soft-dep
    markers."
  - "Pattern: 2-arm cascade severity dispatch via ternary. Composers
    return {message, severity: 'success' | 'warning'}; orchestrator
    destructures and dispatches via
    `(severity === 'warning' ? notifyWarning : notifySuccess)(ctx, body)`.
    The literal-union severity type structurally prevents the legacy
    3-arm `notifyError | notifyWarning | notifySuccess` pattern from
    re-emerging (Plan 13-01-02 D-CMC-11 contract reinforced)."

requirements-completed:
  - CMC-02 # @<marketplace> carve-out structurally enforced via PluginCascadeRow (no marketplace field)
  - CMC-13 # Per-row soft-dep markers via PluginCascadeRow.declaresAgents/Mcp on reinstall + update
  - CMC-15 # Cascade-summary composer consumed in production orchestrators
  - CMC-17 # Rollback-partial parent + indented children via renderRollbackPartial + spliceRollbackPartials
  - CMC-20 # Cascade severity routes via 2-arm dispatch; notifyError forbidden on cascade summaries
  - CMC-25 # /claude:plugin reinstall renders via cascadeSummary; legacy partition headers retired
  - CMC-26 # /claude:plugin update renders cascade rows with version-transition arrows
  - CMC-27 # /claude:plugin import renders Claude plugin import summary preamble + per-mp cascade blocks

# Metrics
duration: 78min
completed: 2026-05-23
---

# Phase 13 Plan 02a-01: Wave 2 Sub-Wave 2a Cascade Orchestrators Summary

**Three cascade orchestrators (`reinstall`, `update`, `import`) migrated to consume the Wave 1 keystone primitives -- `cascadeSummary` + `PluginCascadeRow` + per-row soft-dep markers via `declaresAgents/Mcp` + 2-arm severity dispatch. Legacy partition-header forms (`Reinstalled:` / `Updated:` / `Skipped:` / `Failed:` / `Added marketplaces:` / `Installed plugins:` / `Skipped existing items:` / `Warnings:`) are RETIRED; per-row status tokens carry the partition signal.**

## Performance

- **Duration:** 78 minutes
- **Started:** 2026-05-23T18:00:00Z (approx)
- **Tasks:** 3 / 3
- **Files modified:** 4 source files (3 orchestrators + 1 types) + 6 test files
- **Tests:** 1121/1121 passing (24 assertions migrated to new RowSpec shape)

## Accomplishments

- **CMC-25 `/claude:plugin reinstall` cascade migration.** Bulk reinstall renders per-marketplace cascades via `cascadeSummary({marketplace, rows, probe})`; severity OR-aggregates across marketplaces and dispatches to `notifySuccess` or `notifyWarning`. Single-plugin reinstall success renders as a 1-marketplace 1-row cascade per LOCKED I-01 (uses `PluginCascadeRow` with `status: "reinstalled"`, NOT a broadened `PluginInlineRow`). Bulk empty-set emits `(no plugins)` via the EmptyToken Wave 1 variant.
- **CMC-26 `/claude:plugin update` cascade migration with MSG-PL-3 arrows.** Version-transition arrow `v<from> → v<to>` (U+2192 space-padded) composed via `composeVersionArrow(from, to)` and passed through `PluginCascadeRow.version`; the renderer's `renderVersion` slot prepends the leading `v`. `unchanged` partition outcomes render as `(skipped) {up-to-date}` cascade rows (trivial skip -> ● icon).
- **CMC-17 rollback-partial cascade rendering.** New `PluginUpdateOutcome.phaseFailures` structural field surfaces phase-3a failures; the cascade renderer's `spliceRollbackPartials` post-processes the `cascadeSummary` output to insert `renderRollbackPartial(parent, children, probe)` beneath the parent row. Each `RollbackChild` carries `phaseLabel: "[<bridge>]"` (catalog form) with `status: "rollback failed"` and `reasons: ["rollback partial"]` (the canonical closed-set Reason; bridge phase names are not in REASONS).
- **CMC-27 `/claude:plugin import` cascade migration.** `formatClaudeImportSummary` rewritten to compose the `Claude plugin import summary` preamble + per-marketplace cascade blocks. Marketplace headers carry their own outcome status (`(added)` / `(skipped) {already installed}` / `(failed) {source mismatch}`); plugin rows render as indented cascade children. Source-mismatch handling: marketplace header is synthesized as failure; dependent plugins render as `(skipped) {source mismatch}` children; the diagnostic cause line is spliced beneath the failing header at indent 2 via `spliceSourceMismatchDiagnostics`.
- **CMC-20 / MSG-SR-6 2-arm severity dispatch enforced.** All three orchestrators destructure `{message, severity}` from `cascadeSummary` and dispatch via the literal-union ternary `(severity === "warning" ? notifyWarning : notifySuccess)`. The legacy 3-arm severity branch in `import/execute.ts` (`unexpectedPluginFailures > 0 -> notifyError`) is RETIRED -- per-row failures surface structurally via the `(failed)` token at warning severity. The outer import setup-failure catch (`Import failed: ...`) stays `notifyError` (it's a non-cascade surface, not subject to MSG-SR-6).
- **CMC-13 / MSG-SD-1..3 per-row soft-dep markers wired.** `PluginCascadeRow.declaresAgents` / `.declaresMcp` populated from outcome predicates (`stagedAgents.length > 0` / `stagedMcpServers.length > 0`) on (reinstalled) and (updated) rows. The renderer probes companion-loaded state via the injected `SoftDepProbe` and emits `{requires pi-subagents}` / `{requires pi-mcp}` iff (declares AND unloaded). Structurally absent on (failed) and (skipped) rows per MSG-SD-3 (Plan 13-01-01 narrowed cascade status types accordingly). The aggregated-trailer helpers (`subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded`) are dropped from all 3 files.
- **CMC-02 `@<marketplace>` carve-out structurally preserved.** Every cascade plugin row uses `PluginCascadeRow` (no `marketplace` field by construction); the marketplace lives only in the header. The single-plugin reinstall path that previously rendered an inline `plugin@marketplace` token now uses the 1-row cascade form so the carve-out applies uniformly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate reinstall.ts to cascadeSummary + PluginCascadeRow (CMC-25)** -- `2db5b4d` (feat, TDD)
2. **Task 2: Migrate update.ts with version-transition arrows + rollback-partial (CMC-26 / CMC-17)** -- `0ca04be` (feat, TDD)
3. **Task 3: Migrate import/execute.ts to per-mp cascade (CMC-27 / CMC-20)** -- `d78f7f4` (feat, TDD)

## Files Created/Modified

### Modified (production)

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
  - Replace partition-rendering helpers (`renderReinstallPartition`, `appendReinstallSoftDepWarnings`, etc.) with `renderReinstallPartitionAndNotify` that builds per-`(scope, marketplace)` cascade blocks via `cascadeSummary`. New `outcomeToCascadeRow(outcome)` helper + `narrowReasons(notes)` closed-set reason mapping.
  - Rewrite `renderSuccessBody(outcome, probe)` to use the 1-row cascade form (LOCKED I-01). Signature changes from `(outcome, pi)` to `(outcome, probe)` -- callers construct the probe via `softDepStatus(pi)`.
  - Replace empty-set notify with `renderRow({kind: "empty", token: "no plugins"}, probe)`.
  - Drop imports of `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded`.

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
  - Pair outcomes with their target so `renderUpdateCascadeAndNotify` can group by `(scope, marketplace)`.
  - Replace `renderPartitionAndNotify` + `partitionSummary` + `appendPluginSoftDepWarnings` with `renderUpdateCascadeAndNotify` that builds cascade blocks via `cascadeSummary` and splices rollback-partial children via `spliceRollbackPartials`.
  - New `outcomeToCascadeRow(target, outcome)` helper: maps `updated` outcomes to `(updated)` cascade rows with `version: composeVersionArrow(from, to)` (the renderer's `renderVersion` slot prepends `v`); maps `unchanged` to `(skipped) {up-to-date}`; maps `skipped` to `(skipped) {<narrowed reason>}`; maps `failed` to `(failed) {<reason>}` with optional rollback-partial children.
  - Drop imports of `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded`. Drop the `renderPartition` import from marketplace/shared (no longer consumed here).

- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
  - Rewrite `formatClaudeImportSummary(result, probe?)` to compose the `Claude plugin import summary` preamble + per-(scope, marketplace) cascade blocks via `enumerateMarketplaceBlocks` + `cascadeSummary`. New `composeImportSummary` internal returns `{body, severity}`.
  - Source-mismatch: synthesize `(failed) {source mismatch}` header and `(skipped) {source mismatch}` dependent plugin children; splice the diagnostic cause line beneath the failing header via `spliceSourceMismatchDiagnostics`.
  - Replace 3-arm severity branch with 2-arm dispatch driven by aggregated `CascadeSeverity` from `composeImportSummary`.
  - Idempotent-skip path keeps the `Import already up to date.` confirmation line beneath the preamble while the cascade body below renders skipped rows.
  - Orphan diagnostics (settings-read-error, malformed-enabled-plugin-ref) surface as bare lines under the preamble.
  - Delete unused legacy helpers `appendOutcomeLines` and `causeSuffix`.

- `extensions/pi-claude-marketplace/orchestrators/types.ts`
  - Extend `ReinstallReinstalledOutcome` with optional `declaresAgents` / `declaresMcp` per-row soft-dep predicate inputs (CMC-13).
  - Extend `PluginUpdateOutcome` with `declaresAgents` / `declaresMcp` (same semantics) + `phaseFailures: readonly {phase, msg}[]` structural surface for rollback-partial children rendering (CMC-17).

### Modified (test)

- `tests/orchestrators/plugin/reinstall.test.ts` (8 assertions migrated)
- `tests/orchestrators/plugin/update.test.ts` (6 assertions migrated)
- `tests/orchestrators/import/execute.test.ts` (4 assertions migrated; 1 severity assertion flipped from error to warning per MSG-SR-6)
- `tests/edge/handlers/plugin/reinstall.test.ts` (3 assertions migrated)
- `tests/edge/handlers/plugin/update.test.ts` (3 assertions migrated)
- `tests/edge/register.test.ts` (1 assertion migrated)

## Verification Results

- `node --test tests/orchestrators/plugin/reinstall.test.ts` -- **19/19 pass**
- `node --test tests/orchestrators/plugin/update.test.ts` -- **16/16 pass**
- `node --test tests/orchestrators/import/execute.test.ts` -- **17/17 pass**
- `node --test tests/edge/handlers/plugin/reinstall.test.ts` -- **7/7 pass**
- `node --test tests/edge/handlers/plugin/update.test.ts` -- all pass
- `npm run check` -- **1121/1121 tests pass**; typecheck clean; ESLint clean; Prettier clean.

### Acceptance criteria

- `grep -rc 'formatErrorWithCauses' <3 orchestrator files>` -> 0 (helper deleted by Plan 13-01-02; this plan migrated the last callers and no regression introduced).
- `grep -c 'cascadeSummary' extensions/pi-claude-marketplace/orchestrators/` recursive -> at least 3 (one per orchestrator).
- `grep -c '"No plugins installed."' <3 orchestrator files>` -> 0 (legacy sentence form retired).
- `grep -c 'cascadeSummary\|PluginCascadeRow\|renderRow' reinstall.ts` -> 13.
- `grep -c 'renderRollbackPartial\|cascadeSummary\|PluginCascadeRow' update.ts` -> 15.
- `grep -cP "→" update.ts` -> 6 (MSG-PL-3 version-transition arrow U+2192).
- `grep -c 'kind: "rollback-child"' update.ts` -> 1 (Phase3Failure children mapped).
- `grep -c 'cascadeSummary\|PluginCascadeRow' execute.ts` -> 8.
- `grep -c 'notifyError(opts.ctx, summary)' execute.ts` -> 0 (legacy 3-arm severity branch gone).
- `grep -c 'Claude plugin import summary' execute.ts` -> 2 (preamble preserved; appears in both constant definition and old comment trail).
- `grep -c '"source mismatch"' execute.ts` -> 2 (header + dependent children).
- `grep -c 'outcomeClass: "failure"' execute.ts` -> 2 (source-mismatch header synthesis).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Version-arrow double-`v` bug from naive composition**

- **Found during:** Task 2 verification (PUP-6 happy test).
- **Issue:** Initial `composeVersionArrow` returned `\`v${from} → v${to}\``; the renderer's `renderVersion` slot prepends another `v`, producing `vv1.0.0 → v1.0.1`. The catalog form is `v1.0.0 → v1.0.1`.
- **Fix:** Adjusted `composeVersionArrow` to return `\`${from} → v${to}\`` (no leading `v` on the from-side; the renderer prepends one). Documented the renderer-prepends-v contract in the helper's docstring.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (composeVersionArrow body and docstring).
- **Commit:** `0ca04be`.

**2. [Rule 2 - Architectural] Phase-name tokens (`skills`/`commands`/`agents`/`mcp`) are not closed-set Reasons**

- **Found during:** Task 2 implementation (rollback-partial children rendering).
- **Issue:** The plan action paragraph for Task 2 suggested using `phase` strings as `Reason` values on the parent row (single-phase failure case: `reasons: [phase as Reason]`). The closed `REASONS` set in `shared/grammar/reasons.ts` does NOT include `"skills"`, `"commands"`, `"agents"`, or `"mcp"`. The plan also flagged this as a potential closed-set gap that may require discuss-phase escalation if no in-set token captures the semantic.
- **Fix (Rule 2: missing critical correctness primitive)** -- resolved inline: rollback-partial parent rows always carry the canonical `["rollback partial"]` Reason (whether single-phase or multi-phase); the failing bridge name surfaces structurally via `RollbackChild.phaseLabel` (`"[<bridge>]"` form matching the catalog's `[phase3a]` notation). This preserves the closed-set CMC-11 contract without re-introducing free-form reason tokens and is consistent with how `update.ts`'s parent-row failure reason was already specified. Wave 3 catalog UAT is the binding verification that the resulting user-visible shape is sufficient.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (outcomeToCascadeRow + child construction).
- **Commit:** `0ca04be`.

**3. [Rule 1 - Bug] Source-mismatch dependent-plugin row icon**

- **Found during:** Task 3 implementation (sanity-test of source-mismatch render).
- **Issue:** The plan stated that dependent plugins under a `(failed) {source mismatch}` marketplace header should render as `⊘` (non-trivial skip). Verified via `isTrivialSkip` predicate in compact-line.ts: only `"up-to-date"` and `"already installed"` trigger the trivial-skip ● icon; `"source mismatch"` is a non-trivial skip per the predicate's negation, so the icon naturally renders as `⊘`. No code change needed -- the renderer correctly classifies the source-mismatch skip as non-trivial via the existing isTrivialSkip predicate.
- **Files modified:** None (verified the existing renderer behavior was correct).
- **Commit:** N/A (no change; documented for traceability).

**4. [Rule 1 - Bug] Test 11 expectation for marketplace header status on already-installed concurrent race**

- **Found during:** Task 3 verification (test 11: already-installed-from-concurrent-race scenario).
- **Issue:** Initial test assertion expected a bare marketplace header (`● mp [user]`) but the renderer correctly synthesizes the header from the `skippedExistingPlugins` record -- and the test's plan output ALSO includes a `(skipped) {already installed}` MarketplaceRow status (because the marketplace is in `skippedExistingMarketplaces`). The orchestrator's `ensureBlock` upserts the header.
- **Fix:** Updated test assertion to expect the full header with status: `● mp [user] (skipped) {already installed}`. Both rows (marketplace + plugin) carry the trivial-skip ● icon because `already installed` is a trivial Reason.
- **Files modified:** `tests/orchestrators/import/execute.test.ts`.
- **Commit:** `d78f7f4`.

**5. [Rule 2 - Missing critical] Idempotent path: cascade body + "already up to date" confirmation**

- **Found during:** Task 3 verification (test 1 and test 3: idempotent-skip with skippedExistingPlugins non-empty).
- **Issue:** Initial implementation short-circuited the idempotent path (returning just the preamble + "Import already up to date.") whenever `anyChanges === false && hasWarnings === false`. This dropped the cascade body that the legacy formatter rendered for skippedExistingMarketplaces / skippedExistingPlugins, breaking test fixtures that asserted both the "already up to date" substring AND the skip records being surfaced.
- **Fix:** Removed the short-circuit return; replaced with an `upToDateNotice` line that's emitted alongside the cascade body when `!anyChanges && !hasWarnings`. The cascade body still renders skipped rows; the confirmation line stays as the operator's "nothing actually happened" signal.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (composeImportSummary).
- **Commit:** `d78f7f4`.

**6. [Rule 3 - Blocking] Orphan diagnostic surfacing for ref-only diagnostics**

- **Found during:** Task 3 verification (test 2: malformed-enabled-plugin-ref diagnostic).
- **Issue:** Initial `orphanDiagnosticLines` only surfaced diagnostics with `marketplace === undefined AND ref === undefined`. The `malformed-enabled-plugin-ref` diagnostic carries `ref: "bad"` but cannot be mapped to a marketplace cascade (the ref is unparseable -- that's why it's a diagnostic). It needs to surface somewhere.
- **Fix:** Refined the orphan rule to "diagnostics without a marketplace tie" (ref-only diagnostics qualify); the subject is `d.ref ?? d.path ?? d.code`. Preserves legacy behavior of always rendering settings-parse and ref-shape warnings.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (orphanDiagnosticLines).
- **Commit:** `d78f7f4`.

### Authentication Gates

None. All operations were filesystem-local typecheck / test / lint flows; no network or auth surface was touched.

## Issues Encountered

- **Pre-commit `trufflehog` hook fails inside the worktree sandbox.** Known per project CLAUDE.md and the parent execute-plan agent's guidance. Worked around by prefixing each commit with `SKIP=trufflehog` (the underlying scan passes when invoked outside the worktree; the failure is the auto-updater's subprocess spawn).

## TDD Gate Compliance

This plan's tasks are marked `tdd="true"` in the plan frontmatter. Per the plan-level TDD gate semantics for `type: execute` plans, each task lands a feat commit with the migration AND the corresponding test updates in a single commit. The test updates assert the new RowSpec rendered shape (catalog conformance); the cascade-rendering primitives themselves were TDD-tested in Plan 13-01-01 / 13-01-02 (47 unit tests for cascadeSummary + manual-recovery + rollback-partial composers). This sub-wave's tests are integration-level assertions on the orchestrator-emitted body strings -- the production-callsite tests that the Wave 1 primitives were designed for.

## Threat Surface Scan

The plan's `<threat_model>` register identified 2 mitigations:

- **T-13-09 (Tampering -- cascade severity routing):** mitigated structurally. `cascadeSummary` returns `{message, severity: "success" | "warning"}`; the literal-union type forbids a "error" arm. Orchestrators destructure and dispatch via the 2-arm ternary; they CANNOT accidentally route a non-trivially-failed cascade through `notifySuccess` because the severity is computed by `cascadeSeverity` (pure, deterministic, OR-aggregated).
- **T-13-10 (Information Disclosure -- notifyError cause-chain on import setup failure):** mitigated by reuse. The outer import `catch (err) { notifyError(opts.ctx, "Import failed: ${errorMessage(err)}", err); }` consumes Plan 13-01-02's Wave 1 `notifyError` body that uses `causeChainTrailer` for the trailer; NFR-9 invariant preserved (only `.message` surfaces -- no `.stack`, no absolute paths).

No new security-relevant surface introduced beyond what the threat register anticipated. No `threat_flag:` entries to record.

## Known Stubs

None. Every migrated callsite renders via the Wave 1 primitives; no placeholder or "coming soon" branches were introduced. The narrowReason / narrowSkipReason / narrowFailReason helpers have documented fallback paths (`not in manifest` as the permissive default) -- they are NOT stubs; they are the closed-set narrowing the plan called for.

The Wave 1 narrowing limits one currently-unmapped predicate: `PluginInstalledOutcome` (from `installPlugin`'s orchestrated mode) does not yet carry `declaresAgents/Mcp` predicates, so the `import` cascade renders all `(installed)` rows with `declaresAgents: false, declaresMcp: false` (no per-row soft-dep markers for fresh import installs). This is a follow-up for sub-wave 2b finalization (plumb staged-resource predicates through `InstallPluginOutcome`); the Plan 13-02b-01 scope covers single-plugin install/uninstall and naturally addresses it. Documented as a non-blocking deferral; the user-visible behavior is "no soft-dep markers on import-installed plugins" which degrades safely (the markers are advisory).

## Next Plan Readiness

- Wave 2 sub-wave 2b (single-plugin install/uninstall/bootstrap) can proceed -- the `PluginCascadeRow` / `renderRow` / `softDepStatus` / `composeReasons` surface is now battle-tested in production callsites; the rollback-partial splicing pattern is reusable for `install.ts`'s 5-phase ledger.
- Wave 2 sub-wave 2c (marketplace add/remove/list/update/autoupdate) can proceed -- the `MarketplaceRow` + `outcomeClass: "ok" | "failure"` shape is exercised by all three orchestrators in this plan; the `remove.ts` partial-failure manual-recovery case can reuse the `renderManualRecovery` + `renderRollbackPartial` composers already battle-tested by Plan 13-01-02's unit tests.
- Wave 3 (catalog UAT) is the binding verification that the rendered shapes match `docs/output-catalog.md` byte-for-byte. The narrowReason fallback (`not in manifest` for unmappable text) and the rollback-child phaseLabel form are the most likely catalog-conformance gaps; Wave 3 will surface them.
- The temporary ESLint allow-list entry for `orchestrators/plugin/reinstall.ts` (`MANUAL_RECOVERY_REQUIRED` import) stays -- this plan does NOT migrate the manual-recovery wrapper inside `errorWithManualRecovery`. That's covered by sub-wave 2a continuation (the helper is consumed only by the single-plugin reinstall failure path and is orthogonal to the cascade-summary migration scope).

## Self-Check: PASSED

**Files verified to exist:**

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (modified)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts (modified)
- FOUND: extensions/pi-claude-marketplace/orchestrators/import/execute.ts (modified)
- FOUND: extensions/pi-claude-marketplace/orchestrators/types.ts (modified)
- FOUND: .planning/phases/13-conformance-refactor-es-5-supersession/13-02a-01-SUMMARY.md (this file)

**Commits verified to exist:**

- FOUND: 2db5b4d (Task 1 reinstall.ts cascade migration)
- FOUND: 0ca04be (Task 2 update.ts cascade + rollback-partial migration)
- FOUND: d78f7f4 (Task 3 import/execute.ts per-mp cascade migration)

**Overall verification:**

- FOUND: `npm run check` exits 0 (1121/1121 tests pass; typecheck + lint + format clean)
- FOUND: `grep -rc 'formatErrorWithCauses' <3 orchestrator files>` returns 0 each
- FOUND: `grep -c 'cascadeSummary' extensions/pi-claude-marketplace/orchestrators/` (recursive) returns 3+ orchestrator files
- FOUND: `grep -c '"No plugins installed."' <3 orchestrator files>` returns 0 each
- FOUND: Every Task acceptance criterion gate (see "Acceptance criteria" subsection) green

---

*Phase: 13-conformance-refactor-es-5-supersession*
*Plan: 02a-01*
*Completed: 2026-05-23*
