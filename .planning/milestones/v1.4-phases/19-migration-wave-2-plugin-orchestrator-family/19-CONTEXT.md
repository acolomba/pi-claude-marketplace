# Phase 19: Migration Wave 2 -- Plugin Orchestrator Family - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning. Phase 18 (Migration Wave 1 -- Marketplace Orchestrator Family) landed 2026-05-27; the dependency is satisfied. All 5 plugin orchestrators already accept `pi: ExtensionAPI` (verified by codebase scout) so NO Wave 0 plumbing plan is required (Phase 18's Wave 0 plumbing precedent does not repeat here).

<domain>
## Phase Boundary

Migrate every state-change notification callsite in the 5 plugin orchestrators (`orchestrators/plugin/{install,list,reinstall,uninstall,update}.ts`) from the V1 severity-named wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) to the V2 structured entrypoint `notify(ctx, pi, NotificationMessage)`. Drop now-orphaned `presentation/*` composer imports per file. Narrow the MSG-* drift-guard lint to additionally exclude the migrated plugin family. Prove correctness through the catalog UAT byte-equality gate (fixtures already shipped in Phase 17 + 17.1) and through per-file orchestrator unit tests that assert V2 byte shape end-to-end through real `notify()`.

**In scope (this phase):**

1. Migrate `orchestrators/plugin/uninstall.ts` (5 V1 callsites; **Wave 1 pilot** -- locks the V2 inline-cascade construction recipe so Wave 2 (Plans 19-02..05) can mirror it across the remaining 4 plugin orchestrators).
2. Migrate `orchestrators/plugin/install.ts` (8 V1 callsites; standalone-mode single-shot + rollback-partial path + post-commit warning drops). Retires the local `composeRollbackPartialBody` helper entirely per D-19-03.
3. Migrate `orchestrators/plugin/list.ts` (3 V1 callsites; single-shot list surface). Drops the `PROBE_FAILURES` summary `notifyWarning` per D-19-01.
4. Migrate `orchestrators/plugin/reinstall.ts` (7 V1 callsites; cascade-summary + manual-recovery anchor + dispatch ternary). Replaces inline `cascadeSummary({...}); dispatch(ctx, message)` with inline-built `notify(ctx, pi, NotificationMessage)` per D-19-02.
5. Migrate `orchestrators/plugin/update.ts` (7 V1 callsites; cascade-summary + version-arrow + rollback-partial + dispatch ternary). Drops the direct-path completion-cache-refresh `notifyWarning` per D-19-01.
6. Update each orchestrator's unit tests in lockstep with its migration (byte-exact V2 assertions per D-18-06 inherited).
7. Drop now-orphaned `presentation/*` composer imports from each migrated orchestrator (each per-file plan owns its own cleanup).
8. Narrow MSG-Block 1 (`msg-sr-1..6`) and MSG-Block 1b (`msg-gr-3`) in `eslint.config.js` to additionally exclude `orchestrators/plugin/**` (additive ignores entry per D-18-07 inherited).
9. Verify catalog UAT (`tests/architecture/catalog-uat.test.ts`) byte-equality stays GREEN for every plugin-family `(section, state)` fixture.
10. Verify `npm run check` GREEN; no orchestrators outside the plugin family have changed call-site shape.

**Out of scope (not Phase 19):**

- **Migrating `edge/handlers/**` (including `edge/handlers/plugin/import.ts`) + V1 3-arg `notifyUsageError` signature** -- Phase 20 (Migration Wave 3 -- Edge + UsageError).
- **Migrating `orchestrators/import/execute.ts`** -- belongs to the edge/import family with Phase 20's edge handlers.
- **Deleting V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 `notifyUsageError`)** -- Phase 21 (SNM-22).
- **Deleting the 34-rule MSG-* lint plugin under `tests/lint-rules/`** -- Phase 21 (SNM-24, SNM-25, SNM-27).
- **Deleting V1 `presentation/*` composers** -- Phase 21 (alongside SNM-22 wrapper deletion). All `presentation/*` composers remain imported by V1 wrappers AND by `orchestrators/import/execute.ts` (Phase 20) until then. `presentation/cascade-summary.ts` stays unmodified in Phase 19 per D-19-02.
- **Touching `tests/presentation/*.test.ts`** -- Phase 21 deletes them with the composers they cover. Phase 19 leaves them alone.
- **Removing the bounded `shared/notify.ts` ignores added by Phase 16 to MSG-Block 4a + 5** -- Phase 21 alongside V1 wrapper deletion.
- **Type-model amendments** -- Phase 15 type model is complete; Phase 17.1 already amended for autoupdate. No further amendments needed in Phase 19 (post-success warning drops per D-19-01 do not require new fields; rollback-partial migration uses the existing `PluginFailedMessage.rollbackPartial` field per SNM-09).

</domain>

<decisions>
## Implementation Decisions

### Post-success "soft warning" notifications (DROP via D-18-01 precedent)

- **D-19-01:** All post-success secondary `notifyWarning` emissions across the 5 plugin orchestrators are DROPPED entirely. V2 catalog has NO representation for any of these surfaces; folding them would either require Phase 15 type-model amendments (rejected) or mis-represent the primary operation severity (rejected). Precedent: Phase 18 D-18-01 dropped `marketplace/remove.ts`'s cleanup-leak warning on the same basis. Concrete drops:

  - **`install.ts` standalone mode (5 sources):**
    - mkdir failure on `pluginDataDir` (AS-6 / D-08, lines 711-720) -- DROP.
    - `dropMarketplaceCache` failure (D-03-INV, lines 726-735) -- DROP.
    - `agentForeignFailures` row count (AS-7 / AG-5, lines 742-752) -- DROP.
    - `bridgeWarnings` per-entry warnings (lines 757-763) -- DROP.
    - PI-13 dependencies declaration note (lines 804-809) -- DROP.
  - **`list.ts` (1 source):** `PROBE_FAILURES` capture-buffer drain into a single summary `notifyWarning` (lines 774-780) -- DROP. The probe failure already manifests in the per-row `unavailable` status when applicable; the summary is redundant.
  - **`reinstall.ts` (2 sources):** `bridgeWarnings` + `maintenanceWarnings` loops after the per-plugin success notify (lines 231-238) -- DROP. The orchestrated-mode path is unaffected (it returns warnings via the `notes` field on `outcome`; that internal path stays).
  - **`update.ts` (1 source):** the direct-path completion-cache-refresh `notifyWarning` inside `runPostUpdateMaintenance` (lines 840-848) -- DROP. The orchestrated/cascade path stays unaffected (no separate warning emitted in cascade mode).

  **Implementation note:** the underlying failures stay observable via internal return values / debug logs where applicable. The orchestrated-mode `postCommitWarnings: readonly string[]` field on `install.ts`'s `InstallOutcome` return shape (line 134) is UNTOUCHED -- that's an internal API consumed by the cascade orchestrator, not a user-visible surface. Only the standalone-mode emissions are dropped.

### Cascade-summary composer migration (INLINE per orchestrator)

- **D-19-02:** Each of `install.ts` / `reinstall.ts` / `update.ts` builds its V2 cascade payload INLINE -- a `plugins: readonly PluginNotificationMessage[]` array wrapped in `marketplaces: [{ name, scope, plugins }]`, passed to a single `notify(ctx, pi, message)` call. `presentation/cascade-summary.ts` is NOT modified in Phase 19 -- it stays alive because `orchestrators/import/execute.ts:399` still imports it (Phase 20 migrates import; Phase 21 deletes the composer). The V1 dispatch ternary (`const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess`) is REMOVED -- `notify()`'s content-derived severity (D-16-11) replaces it.

  **Inline-construction call sites to refactor:**
  - `reinstall.ts:496` -- main cascade (`renderBulkReinstallCascade`). Builds `plugins[]` of `PluginReinstalledMessage` / `PluginSkippedMessage` / `PluginFailedMessage` / `PluginManualRecoveryMessage` variants from the per-plugin `ReinstallPluginOutcome[]`. The per-marketplace iteration becomes `marketplaces[]` entries in display order.
  - `reinstall.ts:1313` -- single-row cascade (the explicitly-targeted single-plugin-reinstall surface). Builds a 1-entry `plugins[]` directly.
  - `update.ts:929` -- main cascade (`renderUpdateCascade`). Same shape as reinstall but with `PluginUpdatedMessage` carrying `from`/`to` per D-15-04.
  - `install.ts` cascade direct-path callsites at 227 + 254 + 783 -- these are aggregate-failure emissions BEFORE the cascade can render; they build a `PluginFailedMessage`-bearing payload with `cause: aggregate` and no `plugins[]` siblings (the batch aborted).

  **Caller-order discipline (D-16-06 inherited):** orchestrators iterate `plugins[]` in display order; `notify()` does not sort. Existing alphabetic sorts (e.g. via `compareByNameThenScope`) move into the orchestrator's payload-construction loop where present.

  **Manual-recovery anchor handling (reinstall.ts):** the existing manual-recovery anchor (CMC-16 / `renderManualRecovery`) becomes a `PluginManualRecoveryMessage` entry in the same `plugins[]` array -- not a separate top-level emission. The V1 "separate top-level manual-recovery line below the cascade body" pattern (reinstall.ts:514-543 commentary) is REPLACED by structural inclusion in the V2 payload. Severity routing through `computeSeverity` correctly classifies a manual-recovery row as `warning` per D-16-11.

### install.ts rollback-partial composer fate (RETIRE entirely)

- **D-19-03:** `composeRollbackPartialBody` (install.ts:846-882) is RETIRED entirely. It currently builds a `PluginInlineRow` parent + `RollbackChild[]` block via `renderRollbackPartial` from `presentation/`. V2's `PluginFailedMessage` carries `cause?: Error` + `rollbackPartial?: readonly { phase: string; cause?: Error }[]` structurally (SNM-09 + SNM-10), and the V2 `notify()` renderer handles all indentation, 4-space cause-chain, and per-phase rollback-child rendering per D-16-08. The orchestrator's install-failure path constructs `PluginFailedMessage` INLINE based on which condition holds:

  - **Rollback partials present** (`failureRollbackPartials.length > 0`): `reasons: ["rollback partial"] as const`, `cause: err` (when `err instanceof Error`), `rollbackPartial: failureRollbackPartials.map((p) => ({ phase: p.phase, cause: p.cause }))`. The V1 phase-label/status pair (`[phase] (rollback failed)`) is reproduced by the V2 renderer from the `phase` field alone.
  - **Entity-shape error** (`classifyEntityShapeError(...)` returns non-undefined): `reasons: [<classified reasons[]>]`, `cause: err`, no `rollbackPartial`. `classifyEntityShapeError` STAYS in `install.ts` -- it returns the `Reason[]` array which now feeds `PluginFailedMessage.reasons` directly instead of a V1 `EntityErrorRow`.
  - **Generic runtime error**: `reasons: [<single closest reason>]` (or empty if no reason classifies; the renderer handles empty reasons[] gracefully), `cause: err`, no `rollbackPartial`.

  **Renderer-as-spec consequence:** the per-phase rollback child's `cause?` field maps 1:1 to a `RollbackPartial.cause` if the ledger captures it. The current `RollbackPartial` shape in `orchestrators/plugin/install.ts` exposes `phase` + `msg`. The migration MAY need to thread an Error through `RollbackPartial` if the ledger only has a `msg: string` and the desired V2 fidelity is `cause: Error`. The planner verifies the ledger's actual shape during research; if only `msg` is available, the V2 payload sets `cause: new Error(p.msg)` so the renderer's 6-space-indent cause-chain output matches the catalog form at `docs/output-catalog.md:316-330`.

### Plan granularity & wave structure (6 plans, 3 waves)

- **D-19-04:** Phase 19 ships **6 plans** -- 5 per-file migration plans + 1 lint/cleanup plan. Plans 19-01..05 each migrate exactly one orchestrator file (uninstall / install / list / reinstall / update) + the file's unit tests + drop that file's now-orphaned `presentation/*` composer imports. Plan 19-06 narrows MSG-Block 1 + 1b in `eslint.config.js` and confirms catalog UAT GREEN end-to-end. Plan-per-file scoping keeps each commit atomic (one orchestrator + its tests) and matches Phase 18's precedent (post-Wave-0, Phase 18 had 5 per-file + 1 lint = 6 plans of substantive work). No Wave 0 plumbing plan is needed (all 5 plugin orchestrators already accept `pi: ExtensionAPI`).

- **D-19-05:** Wave structure is **3 waves**: Wave 1 = 19-01 (`uninstall.ts` pilot only); Wave 2 = 19-02..05 (`install.ts`, `list.ts`, `reinstall.ts`, `update.ts`) in parallel; Wave 3 = 19-06 (lint narrowing + final catalog UAT verification). The pilot-first arrangement locks the V2 NotificationMessage inline-cascade construction recipe on the smallest cascade case before parallelizing across 4 agents. `uninstall.ts` is the right pilot because (a) it has the smallest cascade plugin set (single-shot + cascade dispatch + cause-chain -- no version-arrow, no rollback-partial, no manual-recovery anchor); (b) the cascade-summary inline-construction pattern it locks is the EXACT pattern install/reinstall/update mirror; (c) it covers both the single-shot success-with-reload-hint and the failure-with-cause-chain shapes (also needed by install.ts). Wave-2 plans inherit the locked pattern by reading the merged uninstall.ts diff + recipe block-comment. Wave 3 cannot start until ALL of Wave 2 lands -- the lint narrowing assumes every plugin orchestrator has stopped calling V1 wrappers.

  **Pilot recipe block-comment (per D-18-08-amendment precedent):** Plan 19-01 embeds a 6-10-line `NotificationMessage` inline-cascade construction recipe directly above its `notify(opts.ctx, opts.pi, ...)` call site so Wave 2 plans literally mirror it. Wave-2 agents find it via `grep -n "NotificationMessage cascade recipe" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`.

- **D-19-06:** Wave-2 parallelism is safe because each plan touches a disjoint file pair: `orchestrators/plugin/<file>.ts` + `tests/orchestrators/plugin/<file>.test.ts`. No two plans share a mutating file. The only shared concern is `eslint.config.js` (touched only by Plan 19-06 in Wave 3) and `presentation/cascade-summary.ts` (not touched by Phase 19 per D-19-02).

### Existing orchestrator-test migration (inherits D-18-06)

- **D-19-07:** Each per-file plan (19-01..05) updates the matching `tests/orchestrators/plugin/<file>.test.ts` IN LOCKSTEP with the orchestrator migration. Tests stay END-TO-END through real `notify()` via mock `ctx` -- the existing `makeCtx()` pattern that records `{ message, severity }` tuples is preserved verbatim per Phase 18 precedent. Byte-exact `assert.equal(note.message, "<V2 byte string>")` assertions are rewritten from V1 strings to V2 strings derived from `docs/output-catalog.md` per-section expected shapes (plugin install / uninstall / reinstall / update / list) and from `tests/shared/notify-v2.test.ts` per-variant fixtures where the orchestrator's edge-case shape isn't in the catalog. Behavior assertions stay (notification count, severity tier, state mutations via `loadState`, error types thrown, reload-hint presence/absence via `.includes(...)`). Tests are not factored to a shared notify-fixture module; existing per-orchestrator structure is preserved to minimize diff per Phase 18 inheritance (no shared mock-pi extraction in Phase 19; deferred to Phase 21 cleanup).

  **Test count consequence of D-19-01:** test assertions that currently verify post-success warnings (e.g. `assert.equal(notifications.length, 2)` for "install success + mkdir-failure warning") are rewritten to expect a SINGLE notification per orchestration. Any unit test that specifically targets a dropped warning's content is DELETED outright. The planner identifies these per-file during research.

  **Test count consequence of D-19-03:** install.ts tests covering rollback-partial output flip from V1 string assertions (constructed via the retired `composeRollbackPartialBody`) to V2 byte strings constructed by `notify()` from a `PluginFailedMessage` with `rollbackPartial: [...]`. The catalog fixture at `docs/output-catalog.md:318-332` ("Failure with rollback-partial children") is the reference shape.

### MSG-* lint glob narrowing strategy (inherits D-18-07)

- **D-19-08:** Plan 19-06 extends ONLY the existing additive `ignores: [...]` entry on MSG-Block 1 (`msg-sr-1..6` severity routing) and MSG-Block 1b (`msg-gr-3` per-scope rendering) in `eslint.config.js`. The entry currently reads `["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` (added by Phase 18 Plan 18-06); Plan 19-06 ADDS `"extensions/pi-claude-marketplace/orchestrators/plugin/**"` so the array becomes `["...orchestrators/marketplace/**", "...orchestrators/plugin/**"]`. MSG-Block 1b's existing `edge/handlers/**` files entry is unchanged (Phase 20 owns that surface). All other MSG-Blocks (2, 3, 4a, 4b, 5, 6) need NO modification in Phase 19. Phase 20 extends the same array with `orchestrators/edge/**` AND removes Block 1b's `edge/handlers/**` files entry; Phase 21 deletes the entire MSG-* plugin wiring. Additive narrowing keeps each phase's lint diff small and reviewable.

### Claude's Discretion

The planner has flexibility on:

- Exact ordering of file mutations within each per-file plan (e.g., update the orchestrator first or the test file first -- both are atomic within a single plan commit).
- Whether to extract a tiny shared helper for the common `pi: { getAllTools: () => [] }` mock-pi shape (Phase 18 Claude's Discretion -- left inlined). Phase 19 may continue inline or extract; either satisfies the test pattern.
- Whether to clean up the small `// notifyError auto-appends ...` D-CMC-12 comment block in `orchestrators/plugin/shared.ts` (or wherever stale V1 comment lines persist post-migration) inside the per-file plan that last touches the file, or inside plan 19-06, or defer to Phase 21. None of these comments call notify; cosmetic only.
- Specific severity-tier assertion form: `assert.equal(note.severity, undefined)` (status quo) vs. helper like `assertSeverity(note, "info")`. Either is acceptable.
- Whether the install.ts cascade-direct-path emissions at lines 227 + 254 + 783 (the `notifyError(ctx, errorMessage(err), err)` after aggregate Phase-3a failure) construct a `MarketplaceNotificationMessage` with `plugins: []` (a bare failed-mp shape) OR with a single synthetic `PluginFailedMessage { name: "<aggregate>" }` -- the catalog doesn't have an explicit aggregate-failure fixture, and either shape is defensible. Planner picks the one that round-trips cleanly through `notify()` and minimizes byte-string churn in tests.
- Whether `runPostSuccessMaintenance` (reinstall.ts) and `runPostUpdateMaintenance` (update.ts) -- now devoid of user-visible emission paths after the D-19-01 drops -- get inlined into their callers or kept as named helpers. Either is acceptable; the migration just removes the notify-wrapper paths inside them.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth design

- `.planning/ROADMAP.md` §"Phase 19: Migration Wave 2 -- Plugin Orchestrator Family" -- Goal + 4 success criteria. SC #2 (MSG-* lint narrowing) is satisfied by D-19-08; SC #3 (catalog UAT GREEN for plugin family) is satisfied by Phase 17 + 17.1 fixtures + D-19-07 test discipline; SC #1 (zero V1 callers in `orchestrators/plugin/**`) is the migration result; SC #4 (`npm run check` GREEN, other families unchanged) is the gate Plan 19-06 verifies.
- `.planning/REQUIREMENTS.md` §"Migration & Deletion" SNM-22 -- "All notifySuccess/Warning/Error call sites across orchestrators (~20 sites) migrated... V1 severity-named wrappers are deleted from shared/notify.ts." Phase 19 satisfies the "plugin family migrated" partial (Phase 18 already closed marketplace; Phase 20 closes edge; Phase 21 closes the requirement when V1 wrappers are deleted). Phase 19 closes ZERO requirements directly -- it's a pure execution phase contributing to SNM-22 closure.
- `docs/output-catalog.md` -- Phase 17 v2.0 catalog. BINDING USER CONTRACT for every plugin-family command surface. Sections to honor: `## /claude:plugin list` (lines 133-263), `## /claude:plugin install` (lines 265-332), `## /claude:plugin uninstall` (lines 336-377), `## /claude:plugin reinstall` (lines 380-486), `## /claude:plugin update` (lines 489-568). The bootstrap section (lines 656-684) is part of plugin family but bootstrap.ts has zero V1 callsites (it composes addMarketplace + setMarketplaceAutoupdate which are already V2 post-Phase-18); no migration work in 19 for bootstrap.ts.
- `docs/messaging-style-guide.md` -- Phase 17 v2.0 pointer doc. Cross-reference for renderer-as-spec discipline; types are the contract.
- `docs/adr/v2-001-structured-notify.md` -- Accepted (Phase 15 D-15-13). Phase 17.1 amendment captured the autoupdate grammar change; no further amendment in Phase 19.

### V2 renderer & types (binding contract)

- `extensions/pi-claude-marketplace/shared/notify.ts` -- The v2 grammar IS this file's renderer behavior. `notify(ctx, pi, message)` at line 1034 is the binding entry point. `PluginInstalledMessage` / `PluginUpdatedMessage` / `PluginReinstalledMessage` / `PluginUninstalledMessage` / `PluginAvailableMessage` / `PluginUnavailableMessage` / `PluginUpgradableMessage` / `PluginFailedMessage` / `PluginSkippedMessage` / `PluginManualRecoveryMessage` types at lines 325-459. `renderPluginRow` (file-private) owns the plugin row switch with `assertNever` exhaustiveness. `composeMarketplaceBlock` joins header + plugin rows. `softDepStatus(pi)` probes at notify-time per `notify()` invocation (single probe, D-16-14). NOT modified by Phase 19 -- this phase only IMPORTS from it.
- `tests/shared/notify-v2.test.ts` -- Phase 16's per-variant unit tests + Phase 17.1's amendment tests + Phase 17.2's orphan-fold tests (1141+ lines, 32+ tests). Authoritative source of V2 expected output strings per (plugin status x marketplace status x edge case). Phase 19 orchestrator tests cross-reference these fixtures when an edge-case byte shape isn't covered by the catalog (e.g. cascade-failure-cause-chain shapes).
- `tests/architecture/catalog-uat.test.ts` -- Phase 17 byte-equality runner. Drives every `(section, state)` catalog fixture through `notify(mockCtx, mockPi, message)` and asserts byte-equality against the catalog block. Phase 19's Plan 19-06 verifies this stays GREEN end-to-end after every plugin orchestrator has migrated. Fixture map keys for plugin family span the 5 plugin sections in `docs/output-catalog.md` (install / uninstall / reinstall / update / list).

### Phase 18 lineage (controlling migration decisions inherited)

- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-CONTEXT.md` -- Decisions D-18-01..D-18-09. D-18-01 (DROP V1 surfaces with no V2 representation -- the binding precedent for D-19-01); D-18-06 (test discipline -- byte-exact end-to-end through real notify() -- inherited by D-19-07); D-18-07 (additive MSG-* lint narrowing -- inherited by D-19-08); D-18-08-amendment (Wave 1 pilot embeds construction recipe block-comment -- inherited by Plan 19-01).
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-01-SUMMARY.md` -- Wave 1 pilot (`add.ts`) recipe block-comment. The 10-line construction recipe at `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:160-169` is the structural precedent Plan 19-01 mirrors (substituting plugin-cascade construction for marketplace single-shot construction).
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-06-SUMMARY.md` -- Lint narrowing precedent. The additive `ignores: [...]` entry on MSG-Block 1 + 1b is the entry Plan 19-06 extends.

### Phase 17 / 17.1 / 17.2 lineage (catalog + grammar contract)

- `.planning/phases/17-spec-rewrite-catalog-uat-migration/17-CONTEXT.md` -- Decisions D-17-01..D-17-10. D-17-03 (pure exclusion: catalog UAT drives notify() only); D-17-10 (V1 install-failure-with-anchor dropped from V2 catalog -- precedent reinforcing D-19-01).
- `.planning/phases/17.1-v2-grammar-amendment-autoupdate-surface/` -- Type model + renderer + catalog amendments for autoupdate. No further amendments needed in Phase 19 (D-19-01 drops by precedent; D-19-03 reuses existing SNM-09 `rollbackPartial` field).
- `.planning/phases/17.2-renderscope-bracket-orphan-fold-contract-fix/` -- Phase 19 orchestrator tests must construct payloads that round-trip through the orphan-folded renderer (plugin-scope bracket suppressed when `p.scope === mp.scope`).

### Phase 16 / 15 lineage (renderer & type-model decisions)

- `.planning/phases/16-renderer-public-api-alongside-v1/16-CONTEXT.md` -- D-16-04 (renderer-as-spec); D-16-06 (caller-order honored -- orchestrators control iteration order); D-16-08 (4-space indent for cause-chain under plugin row, 6-space for rollback-child cause); D-16-11 (severity ladder -- failed/skipped/manual recovery routing); D-16-12 (reload-hint trigger ladder); D-16-14 (single softDepStatus probe per notify call); D-16-15 (soft-dep markers at render time).
- `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` -- D-15-02 (`dependencies` on installed/updated/reinstalled variants); D-15-04 (`from`/`to` on updated variant only); D-15-08/09 (empty arrays IS the structural empty sentinel).

### Source files Phase 19 modifies

- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- 5 V1 callsites: `notifyError` at 160 (direct-path failure); `notifyWarning` at 179 + 200 (cascade-failure cause-chain emissions); `notifySuccess` at 232 (single-shot uninstalled success) + 246 (with reload-hint). Plan 19-01 (Wave 1 pilot).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- 8 V1 callsites: `notifyError` at 682 + 700 (failure direct-path); `notifyWarning` at 718 + 733 + 750 + 761 + 808 (5 post-success warnings, ALL DROPPED per D-19-01); `notifySuccess` at 796 (single-shot installed success with reload-hint). Plan 19-02 (Wave 2). Retires `composeRollbackPartialBody` per D-19-03.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` -- 3 V1 callsites: `notifySuccess` at 772 (single-shot list success); `notifyWarning` at 777 (PROBE_FAILURES summary -- DROPPED per D-19-01); `notifyError` at 783 (failure path). Plan 19-03 (Wave 2). Drops `PROBE_FAILURES` module-level capture-buffer drain.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- 7 V1 callsites: `notifyError` at 197 + 254 (failure direct-paths); `notifyWarning` at 233 + 237 (DROPPED per D-19-01: post-success bridge + maintenance warnings); `notifySuccess` at 240 + 263 (single-plugin success + empty-targets success); cascade dispatch ternary at 543. Plan 19-04 (Wave 2). Replaces `cascadeSummary({...})` calls at 496 + 1313 with inline-built `MarketplaceNotificationMessage` per D-19-02.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- 7 V1 callsites: `notifyError` at 170 + 227 + 254 + 783 (direct-path failures); `notifySuccess` at 178 (empty-plugins success); `notifyWarning` at 844 (direct-path completion-cache-refresh -- DROPPED per D-19-01); cascade dispatch ternary at 952. Plan 19-05 (Wave 2). Replaces `cascadeSummary({...})` call at 929 with inline-built payload.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- Likely comment-only changes (stale D-CMC-12 / V1 wrapper references). Planner discretion on when to clean.
- `tests/orchestrators/plugin/uninstall.test.ts` -- Byte-exact assertions rewritten to V2 shape. Plan 19-01.
- `tests/orchestrators/plugin/install.test.ts` -- Byte-exact assertions rewritten; post-success warning assertions DELETED (per D-19-01); rollback-partial assertions rewritten to V2 byte strings constructed by `notify()` from `PluginFailedMessage.rollbackPartial`. Plan 19-02.
- `tests/orchestrators/plugin/list.test.ts` -- Byte-exact assertions rewritten; PROBE_FAILURES-summary assertions DELETED (per D-19-01). Plan 19-03.
- `tests/orchestrators/plugin/reinstall.test.ts` -- Byte-exact assertions rewritten; bridge/maintenance-warning assertions DELETED. Plan 19-04.
- `tests/orchestrators/plugin/update.test.ts` -- Byte-exact assertions rewritten; completion-cache-refresh-warning assertions DELETED. Plan 19-05.
- `eslint.config.js` -- Plan 19-06 ADDS `"extensions/pi-claude-marketplace/orchestrators/plugin/**"` to MSG-Block 1 (lines ~152-169) and MSG-Block 1b (lines ~170-188) `ignores: [...]` array. No other changes.

### Source files Phase 19 reads but does NOT modify

- `extensions/pi-claude-marketplace/shared/notify.ts` -- V2 renderer + types. Phase 19 only IMPORTS `notify`, `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage` (and the per-variant types `PluginInstalledMessage` etc. as needed for type narrowing).
- `extensions/pi-claude-marketplace/presentation/cascade-summary.ts` -- V1 cascade composer. Stays alive per D-19-02 (imported by `orchestrators/import/execute.ts` -- Phase 20). Phase 19 just drops the imports from the 3 plugin orchestrators that currently use it.
- `extensions/pi-claude-marketplace/presentation/{rollback-partial,manual-recovery,cause-chain,version-arrow,compact-line,reload-hint,sort}.ts` -- V1 composers. Each per-file Phase 19 plan DROPS its file's imports of these. After Phase 19, `cause-chain`, `manual-recovery`, `rollback-partial`, `version-arrow` become orphaned (no remaining importers); Phase 21 deletes them. `compact-line`, `reload-hint`, `sort`, `cascade-summary` still have non-plugin importers and stay alive until Phase 21 (some via import/execute.ts).
- `tests/presentation/*.test.ts` -- Stays untouched (composer tests remain valid until Phase 21 deletes the composers).
- `tests/architecture/catalog-uat.test.ts` -- Plan 19-06 only READS this file to verify GREEN status; the test runner itself is not modified.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`tests/orchestrators/plugin/*.test.ts` mock-ctx pattern** -- Each file defines a local `makeCtx()` that returns `{ ctx, notifications: NotifyRecord[] }` recording `{ message, severity }` tuples. The pattern threads through `pi: { getAllTools: () => [] }` for `softDepStatus(pi)`. Phase 19 preserves this pattern verbatim per D-19-07 (inheriting Phase 18 D-18-06); the only change is the byte-string assertion targets.
- **`extensions/pi-claude-marketplace/shared/notify.ts::notify`** -- Public V2 entry point. Each migrated orchestrator imports this in place of the V1 wrappers; signature is `(ctx, pi, message)`. The `pi` arg flows through every orchestrator already (confirmed by codebase scout -- all 5 plugin orchestrators accept `pi: ExtensionAPI` in their options interface; no Wave 0 plumbing).
- **`tests/shared/notify-v2.test.ts` per-variant fixtures** -- Authoritative source for V2 byte strings when an orchestrator test's scenario isn't directly in the catalog (e.g. cascade-failure cause-chain shapes).
- **`tests/architecture/catalog-uat.test.ts` FIXTURES map** -- Lines covering the 5 plugin command sections already model the V2 `NotificationMessage` payload shapes the orchestrator must construct -- effectively a reference implementation each orchestrator can pattern-match against.
- **`classifyEntityShapeError` (install.ts)** -- Maps thrown errors to closed-set `Reason[]` arrays. Stays alive per D-19-03; now feeds `PluginFailedMessage.reasons` directly instead of building a V1 `EntityErrorRow`.

### Established Patterns

- **Renderer-as-spec discipline (D-16-04 inherited)** -- The V2 grammar IS `shared/notify.ts`'s rendering behavior. Orchestrators MUST construct payloads such that `notify()` emits the catalog-expected bytes. No orchestrator-level string composition of tokens, markers, or trailers.
- **Single-`notify()`-call-per-orchestration discipline (D-18-01 inherited; expanded by D-19-01)** -- Every state-changing orchestrator call emits EXACTLY one `notify()` call with one complete `NotificationMessage`. No SECOND notify after the primary. Post-success "soft warnings" with no V2 representation are DROPPED entirely.
- **Per-plugin cause chains (D-16-08 inherited)** -- `cause?: Error` lives on `PluginFailedMessage` and `PluginManualRecoveryMessage`; renders at 4-space indent below the plugin row. Per-phase rollback-child cause chains render at 6-space indent below the rollback-child row. No marketplace-level cause chains in V2.
- **Caller-order honored (D-16-06 inherited)** -- `notify()` does NOT sort `marketplaces[]` or `plugins[]`. Orchestrators control iteration order. Existing alphabetic sorts via `compareByNameThenScope` move into the orchestrator's payload-construction loop where present.
- **Single `softDepStatus(pi)` probe per `notify()` call (D-16-14 inherited)** -- Phase 19 orchestrators do NOT compute soft-dep state themselves; they declare `dependencies: readonly Dependency[]` on installed/updated/reinstalled plugin rows; `notify()` probes once and threads the result through `renderPluginRow`.
- **Manual-recovery anchor as structural plugin variant (D-19-02 expansion)** -- The V1 "separate top-level manual-recovery line below the cascade body" pattern in `reinstall.ts` is REPLACED by inclusion in the same `plugins[]` array as a `PluginManualRecoveryMessage` variant. Severity routing via `computeSeverity` classifies it correctly.

### Integration Points

- **Phase 18 marketplace migration (LANDED) ↔ Phase 19 plugin migration** -- Marketplace orchestrators are now V2; plugin orchestrators that COMPOSE marketplace orchestrators (e.g. `bootstrap.ts` which calls `addMarketplace` + `setMarketplaceAutoupdate`) inherit V2 byte forms transitively. `bootstrap.ts` has zero V1 callsites of its own -- no migration work in 19. The bootstrap section in the catalog (`docs/output-catalog.md:656-684`) is satisfied by Phase 18's marketplace migration; Phase 19 does NOT touch it.
- **Catalog UAT (Phase 17 + 17.1) ↔ Phase 19 migration** -- Catalog UAT byte-equality MUST stay GREEN across every wave. Wave 1 (uninstall.ts pilot) verifies the inline-cascade construction pattern produces catalog-expected bytes for the simplest cascade shape; Wave 2 verifies for the remaining 4 (install with rollback-partial; list with available/unavailable/upgradable; reinstall with manual-recovery; update with version-arrow); Wave 3 Plan 19-06 runs catalog UAT once more as a final safety net before lint narrowing.
- **MSG-* lint scoping (Phase 14 + Phase 16 bounded windows + Phase 18 additive entry) ↔ Plan 19-06** -- Block 1 + Block 1b gain `orchestrators/plugin/**` in their `ignores: [...]` array (extending the Phase-18 marketplace entry). Block 4a + Block 5 bounded `shared/notify.ts` ignores (Phase 16, ending at Phase 21) are NOT touched by Phase 19. Block 1b's `edge/handlers/**` files entry is unchanged (Phase 20 territory).
- **Phase 20 ↔ Phase 19 lint narrowing** -- Phase 20 extends the same `ignores:` entry with `orchestrators/edge/**`, removes Block 1b's `edge/handlers/**` files entry, and migrates `orchestrators/import/execute.ts` which still imports `cascade-summary`. After Phase 20, presentation/cascade-summary.ts has zero importers; Phase 21 deletes it.
- **`orchestrators/plugin/index.ts` barrel re-export** -- Stays untouched. The barrel re-exports the orchestrator functions; their signatures are unchanged (the V2 migration is internal to each file).

</code_context>

<specifics>
## Specific Ideas

- **DROP-all uniform precedent (D-19-01)** is grounded in Phase 18 D-18-01 and Phase 17 D-17-09/D-17-10. The user accepts that post-commit cleanup warnings, AG-5 foreign-file notes, PI-13 dependencies declarations, and PROBE_FAILURES summaries become non-user-visible in V2. Information stays observable via internal return values (e.g. `InstallOutcome.postCommitWarnings` for orchestrated-mode callers; `ReinstallPluginOutcome.notes` for reinstall) and via the per-plugin `(unavailable)` row in `list.ts` when the underlying probe failure manifests as an unavailable status.

- **Inline-cascade construction recipe (D-19-02 + D-19-05 pilot)** -- Plan 19-01 (`uninstall.ts` pilot) embeds a 6-10-line `// NotificationMessage cascade recipe (Plan 19-01 pilot; Wave 2 mirrors).` block-comment directly above its `notify(opts.ctx, opts.pi, ...)` call. The recipe documents: (a) one `marketplaces[]` entry per affected marketplace; (b) `plugins: readonly PluginNotificationMessage[]` built in display order from the orchestrator's outcome list; (c) discriminator on each plugin variant's `status` field; (d) severity + reload-hint computed by `notify()` per D-16-11 + D-16-12 (orchestrator MUST NOT compose); (e) catalog UAT fixture cross-reference. Wave 2 finds it via `grep -n "NotificationMessage cascade recipe" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`.

- **install.ts standalone-vs-orchestrated mode boundary** -- The V2 migration ONLY touches the standalone-mode emission paths. The orchestrated-mode return shape (`InstallOutcome` with `status`, `resourcesChanged`, `declaresAgents`, `declaresMcp`, `postCommitWarnings`) is UNTOUCHED -- it's an internal API consumed by the cascade orchestrator (cascade caller composes the higher-level `NotificationMessage` from these outcomes). The `notifications?.mode === "orchestrated"` branch shortcuts unchanged; only the `else`-branch standalone notify wrappers migrate to `notify()`.

- **Rollback partial cause-field threading (D-19-03 caveat)** -- The current `RollbackPartial` ledger shape may expose only `phase: string` + `msg: string`. V2 `PluginFailedMessage.rollbackPartial: { phase, cause? }[]` wants an `Error` for the cause. Planner verifies the ledger shape during research; if only `msg: string` is available, the V2 payload synthesizes `cause: new Error(p.msg)` so the renderer's 6-space-indent output matches the catalog form. This is a CONSTRUCTION-side concern only -- no ledger refactor in Phase 19.

- **MSG-Block 1 + 1b ignores entry as an additive contract across Phases 18/19/20** -- The ignore entry that Plan 19-06 extends is THE same array Phase 18's Plan 18-06 introduced and Phase 20 will extend further. Path string added: `"extensions/pi-claude-marketplace/orchestrators/plugin/**"`.

- **No new gray areas surfaced during cross-check.** The discussion explicitly covered Areas 1-4 plus a quick survey of standalone-vs-orchestrated install boundary, classifyInstallFailure tuple handling, PROBE_FAILURES module-level variable lifecycle, and classifyEntityShapeError reasons[] mapping precision -- all resolved within the 4 locked decisions or covered by inherited Phase 18 / 16 / 15 decisions.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 20 (Migration Wave 3 -- Edge + UsageError)** -- Migrates `edge/handlers/**` (including `edge/handlers/plugin/import.ts`) + V1 3-arg `notifyUsageError` -> V2 1-arg form. Also migrates `orchestrators/import/execute.ts` (the last consumer of `presentation/cascade-summary.ts`). Closes SNM-23. Extends MSG-Block 1 ignores with `orchestrators/edge/**`; removes Block 1b's `edge/handlers/**` files entry.
- **Phase 21 (Final Teardown + GREEN gate)** -- Deletes V1 wrappers, the 34-rule MSG-* lint plugin, presentation/* composers (including the now-orphaned cause-chain, manual-recovery, rollback-partial, version-arrow after Phase 19), bounded shared/notify.ts ignores, grammar/* closed-set files (decision pending). Closes SNM-22, SNM-24..29, SNM-32.
- **Test-helper extraction for `makeCtx()` + `pi: { getAllTools: () => [] }`** -- Currently inlined in every orchestrator test file. Cosmetic refactor; deferred to Phase 21 cleanup or a quick task (Phase 18 Claude's Discretion -- left inlined; Phase 19 inherits the inline pattern).
- **`presentation/*.test.ts` (composer tests) deletion** -- Deferred to Phase 21 when the composers themselves are deleted.
- **`orchestrators/plugin/shared.ts` stale comment cleanup** -- references to `notifyError` / D-CMC-12 patterns in comments. Planner discretion (see Claude's Discretion above) within Phase 19, or defer to Phase 21.
- **`RollbackPartial` ledger refactor to expose `Error` instead of `string`** -- Out of scope for Phase 19 per D-19-03 caveat. Phase 19 synthesizes `new Error(p.msg)` at payload-construction time. A future cleanup could thread typed errors through the ledger; backlog.
- **JSON output mode for notifications** -- REQUIREMENTS.md §"Out of Scope" backlog (v1.4 stays English-only with rendered byte output).
- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Carried backlog from Phase 15/16.

### Reviewed Todos (not folded)

None -- `gsd-sdk query todo.match-phase 19` returned `matches: []` and `todo_count: 0`. No pre-targeted todos in the codebase for this phase.

</deferred>

---

*Phase: 19-Migration Wave 2 -- Plugin Orchestrator Family*
*Context gathered: 2026-05-27*
