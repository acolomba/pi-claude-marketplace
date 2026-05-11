# Phase 5: Plugin Orchestrators - Research

**Researched:** 2026-05-10
**Domain:** Plugin orchestrators (install / uninstall / update / list) + COMP-01 resolver array migration + bridge discover.ts iteration updates
**Confidence:** HIGH (every claim is grounded in an existing in-repo file path or in CONTEXT.md's locked decisions; no external library lookups required)

---

## Summary

Phase 5 ships four orchestrator entry points (`install`, `uninstall`, `update`, `list`) plus a shared helper module, mirroring Phase 4's `orchestrators/marketplace/{add,remove,list,update,autoupdate,shared}.ts` layout. Every primitive Phase 5 needs is already in place: the `runPhases<C>` ledger (`transaction/phase-ledger.ts`), the PI-14-aware `formatRollbackError` chokepoint (`transaction/rollback.ts`), the `withStateGuard` ST-7 wrapper (`transaction/with-state-guard.ts`), the four bridges' `prepare/commit/abort/unstage` quartet returning `recorded[]` (W-05) and `failed[]` (W-08 -- AG-5 soft-fail), `cascadeUnstagePlugin` reserved for Phase 5 reuse, the `PluginUpdateFn` / `PluginUpdateOutcome` injection seam, the `composeReloadHint` + `softDepStatus` presentation primitives, and the marker chokepoint at `shared/markers.ts`.

Phase 5's net deltas vs. Phase 4 are small in surface but precise in semantics: (a) extend `formatRollbackError` with one `instanceof PathContainmentError` short-circuit (D-02); (b) extend `shared/markers.ts` with one new prefix constant `RECOVERY_PLUGIN_REINSTALL_PREFIX` plus one new markers-snapshot case (D-04); (c) extend `shared/errors.ts` with four new error classes (`CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError`, `PluginUpdatePhase3Error`); (d) **breaking** change `domain/resolver.ts` `ComponentPathsSchema` from optional-string-per-kind to readonly-string-array-per-kind (D-07 / COMP-01), then thread the array through the three discover.ts files; (e) add `pluginDataDir(loc, mp, plugin)` helper to `persistence/locations.ts` (D-08 -- note: a `pluginDataDir` METHOD already exists on `ScopedLocations` returning a Promise; Phase 5 only needs to consume it, not add a new free function -- see "Code Insight" D-08 below).

**Primary recommendation:** Cut the phase into 6-8 plans following Phase 4's wave structure. Wave 0: shared utility extensions (markers + errors + locations consumption + resolver D-07 + bridge discover.ts updates) + foreign-content state writeback for PU-7. Wave 1: `shared.ts` (PI-6 cross-bridge guard, helper exports) + `presentation/plugin-list.ts` (truncation, icon legend, payload-driven render). Wave 2: install.ts + uninstall.ts + list.ts (parallelizable; same wave). Wave 3: update.ts (depends on install's `InstallCtx` shape if shared) and the `PluginUpdateFn` export wired into Phase 4's seam. Wave 4: REQUIREMENTS.md PR-4 supersession + CHANGELOG entry.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (5-phase literal `Phase<InstallCtx>[]` install ledger):** `install.ts` builds `const phases: readonly Phase<InstallCtx>[] = [skillsPhase, commandsPhase, agentsPhase, mcpPhase, statePhase]` and passes to `runPhases<InstallCtx>(phases, ctx)`. Each bridge maps to one ledger entry: `do = bridge.commit(prep)`, `undo = bridge.unstage(target)`. Skills and commands stay SEPARATE phases (no collapse). Terminal state-commit phase has `do = saveState(state)` and `undo = noop`. Composition with `withStateGuard` follows Phase 2 D-02 verbatim: outer guard wraps `runPhases`; the closure mutates state.snapshot through ctx; state-commit phase's `do` is the final flush trigger before the guard's save.
  - **D-01 corollary (InstallCtx shape):** Local type in `orchestrators/plugin/install.ts` (NOT promoted to `orchestrators/types.ts` until a second consumer needs it). Carries `{ scope, locations, marketplace, plugin, manifest, resolved, prepHandles: { skills, commands, agents, mcp }, stateSnapshot }`. State-commit phase reads the fully-populated snapshot and is the only phase that touches state-io.

- **D-02 (PI-14 exclusion in `formatRollbackError`, NOT the orchestrator catch):** Extend `transaction/rollback.ts`'s `formatRollbackError(result, originalError)` to short-circuit when `originalError instanceof PathContainmentError`. Return original error verbatim, suppress `(rollback partial: …)` summary. Preserves Phase 2 D-03's "single chokepoint."
  - **D-02 corollary (PI-14 testing):** `tests/transaction/rollback.test.ts` gains two cases -- `PathContainmentError` and `SymlinkRefusedError` (subclass) both return verbatim with no rollback-partial wrapping, cause chain intact.

- **D-03 (Hand-rolled three-step `update.ts` -- NOT `runPhases`):** Three explicit phases:
  - **Phase 1 (prepare):** Sequentially call each bridge's `prepare*` into bridge-local tmp. On failure: `abort*` each handle that was successfully prepared so far + `cleanupStaging` + rethrow with cause chained.
  - **Phase 2 (state-guard swap):** Inside `withStateGuard(scope, async (state) => { ... })`: capture `oldSnapshot = state.marketplaces[mp].plugins[plugin].resources`; validate ST-9 (`if (record.installed !== true || record.version !== fromVersion) throw new ConcurrentChangeError(...)`); mutate state in-memory to point at NEW resource names.
  - **Phase 3 (physical replace + soft-dep commit):** Sequentially call each bridge's `commit*`. Aggregate phase-3a failures into a `Phase3Failure[]` array (continue across bridge failures, NOT fail-fast). After all four bridges' commits, run phase-3b: compose RH-5 soft-dep warnings via `softDepStatus(ctx)` keyed on which `stagedAgents`/`stagedMcpServers` actually committed. On ANY phase-3a failure: emit `error`-severity notification with PUP-6 recovery hint (`RECOVERY_PLUGIN_REINSTALL_PREFIX + " \"<name>\"."`) and aggregated cause chain via `formatErrorWithCauses` (depth 5).
  - **D-03 corollary (PUP-7 abort + leak handling):** Phase-3 failure path MUST clean staging dir AND abort remaining prepared agents/MCP handles (idempotent). Leak descriptors via `appendLeaks`/`appendLeakToError`. Original phase-3 error NEVER masked.

- **D-04 (PUP-6 recovery hint as `markers.ts` prefix):** New export `RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"`. `tests/architecture/markers-snapshot.test.ts` gains one new case asserting prefix-equivalence against PRD §5.2.3 PUP-6 byte-for-byte. `update.ts` composes the final hint as `` `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${pluginName}".` ``. The JSDoc on the constant MUST document "PUP-6 recovery hint (Phase 5 extension beyond ES-5)."

- **D-05 (PI-6 guard in `orchestrators/plugin/shared.ts`):** Export `assertNoCrossPluginConflicts(scope, generatedNames: { skills, commands, agents }, state): void`. Pure function -- reads only the passed-in state snapshot. Walks `state.marketplaces[*].plugins[*].resources.{skills,prompts,agents}` from THIS scope only (Phase 2 D-10). Detects exact-string collisions per kind. On conflict: throws `CrossPluginConflictError` listing every conflicting name in deterministic order (skills → commands/prompts → agents; alphabetical within kind). MCP server names EXCLUDED per PRD §6.5.
  - **D-05 callsites:** `install.ts` calls guard immediately after computing generated names from resolved plugin (via `domain/name.ts` generators) and BEFORE invoking any bridge's `prepare*`. `update.ts` calls inside phase-1 prepare (after PUP-1 partitioning, before bridge prepares for `updated` partition).
  - **D-05 corollary (RN-4):** Cross-marketplace agent ownership stays in `bridges/agents/stage.ts::prepareStagePluginAgents` via `findOwnershipConflicts` (Phase 3 D-05).

- **D-06 (orchestrator + presentation split, truncation private):** Two files. `orchestrators/plugin/list.ts` (state read + filters + manifest soft-fail + upgradable computation + `[autoupdate]` headers). `presentation/plugin-list.ts` (pure formatter taking structured payload `{ marketplaces: [{ name, scope, autoupdate, plugins: [...] }] }`). Icon table (`●` installed installable, `○` not installed installable, `⊘` not installable), version parens, status marker, column-66 description truncation all private inside renderer.

- **D-07 (Resolver `ComponentPathsSchema` becomes arrays; supersede PR-4):** V1's `componentPaths: { skills?: string; commands?: string; agents?: string }` becomes `componentPaths: { skills: readonly string[]; commands: readonly string[]; agents: readonly string[] }`. Strict resolver Step 7 / MM-5 computes UNION of declared (entry > manifest) + implicit-by-convention (when conventional path exists), deduplicated by path string. Loose resolver (MM-6 entry-only) stays single-source. PR-4 is SUPERSEDED.
  - **D-07 corollary (bridge discover signature change):** `bridges/{skills,commands,agents}/discover.ts` each iterate over the array. Discovery dedups generated names within a single plugin via `Map<generatedName, sourcePath>`; first wins, second surfaces as warning via bridge's `failed[]` channel. RN-6 (within-plugin source-name collisions) remains a hard error (`assertNoSkillCollisions`, `assertNoCommandCollisions`, `assertNoAgentCollisions`).
  - **D-07 supersession effect:** REQUIREMENTS.md PR-4 strikethrough; PROJECT.md gets new D-24 row; CHANGELOG entry "behavior corrected vs. V1."

- **D-08 (`pluginDataDir` helper consumed in install/uninstall; eager mkdir post-state-commit; rm-rf post-state-commit on uninstall):** Install creates the data dir AFTER state-commit phase succeeds; failure = `warning` severity post-commit leak (state already says installed=true) but does NOT roll back (AS-6). Uninstall deletes data dir AFTER state-commit per PU-2 (leaks = `warning` with leaked path per PU-4). Update PRESERVES data dir.

- **D-09 (Uninstall reuses `cascadeUnstagePlugin`; update.ts exports `updateSinglePlugin: PluginUpdateFn`):** `orchestrators/plugin/uninstall.ts` imports `cascadeUnstagePlugin` from Phase 4's `orchestrators/marketplace/shared.ts`. PU-1 ordering enforced by cascade's internal order. Wraps cascade in `withStateGuard`: capture `oldResources`, run cascade, on success remove plugin record from state, on concurrent-already-gone silent-converge per PU-5. Post-state-commit data-dir cleanup runs OUTSIDE guard per D-08.
  - **D-09 corollary:** `update.ts` exports `updateSinglePlugin: PluginUpdateFn` (consumed by Phase 4 autoupdate cascade) AND `updatePlugins(opts)` (handles PUP-1 bare/`@mp`/`pl@mp`, calls `syncClone` once per marketplace via `gitOps.fetch + checkout`, loops over plugins calling `updateSinglePlugin`). PUP-9: direct (non-cascade) update throw → `error` severity; cascade-invoked throw → captured in `PluginUpdateOutcome.partition = 'failed'`.

### Claude's Discretion

User signed off on every recommended option. Areas reserved for Claude's discretion within the locked framing:

- Internal task slicing (number of waves, plans-per-wave) -- Phase 4 used 10 plans across 3 waves; Phase 5 should aim for 6-8.
- Test taxonomy file layout under `tests/orchestrators/plugin/`.
- The `InstallCtx` shape's exact field ordering.
- Whether to elevate `formatErrorWithCauses` to `shared/errors.ts` (Phase 4 D-09 noted Phase 6 may promote; Phase 5 can do so opportunistically if multiple new sites need it).
- Whether to introduce a `RollbackAggregator` helper or fold the aggregation logic inline (no existing abstraction; see "Code Insight: rollback aggregation" below -- the recommendation is fold inline because `runPhases` already supplies the `RollbackPartial[]` structure for the install ledger; only update.ts's hand-rolled phase 3a needs a fresh aggregator and a 10-line array push is sufficient).

### Deferred Ideas (OUT OF SCOPE)

- `info` subcommand (INFO-01).
- `--force` install / update flags.
- JSON output / dry-run modes.
- Manifest-mtime caching (NFR-8 / PERF-01).
- Session-start autoupdate run.
- Rich interactive selectors for cross-scope ambiguity.
- Parallel update cascade (sequential preserves notification ordering).
- Telemetry / event channels (IL-4 forbids V1).
- Hardlink-based skill copy.
- `pi-subagents` / `pi-mcp-adapter` lifecycle UI.
- PRD §6.4 PR-4 text rewrite (lives in `.planning/` artifacts per D-21/D-23 pattern).
- Cross-scope shadowing warning.
- `update --force` to re-stage on equal version.

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID    | Description (excerpted from REQUIREMENTS.md) | Research Support |
|-------|----------------------------------------------|------------------|
| PI-1  | `<plugin>@<marketplace>` parse, exactly one `@`, both halves non-empty | edge layer (Phase 6) supplies parsed pair; install accepts `{ plugin, marketplace }` |
| PI-2  | Resolution consults cached manifest only; NO network | install.ts MUST NOT import `gitOps` (architectural test enforces) |
| PI-3  | Plugin not in manifest → `Plugin "<name>" not found in marketplace "<mp>".` | `state.marketplaces[mp].plugins` lookup pre-flight |
| PI-4  | Non-installable → `Plugin "<name>" is not installable: <notes>` | `requireInstallable` (`domain/resolver.ts:545`) already throws this exact phrasing |
| PI-5  | Already-installed plugins fail with "already installed" error | `if (state.marketplaces[mp].plugins[plugin] !== undefined) throw new AlreadyInstalledError(...)` (new typed error) |
| PI-6  | Cross-plugin name conflicts block install; one message lists every conflicting name | `assertNoCrossPluginConflicts` in `orchestrators/plugin/shared.ts` (D-05) |
| PI-7  | Version: manifest > entry > `hash-<12hex>` SHA-256 | `computeHashVersion` already exists at `domain/version.ts:30`; precedence helper goes in `install.ts` |
| PI-8  | Staging on same FS; commit atomic rename; cleanupWarnings surface | Bridges already enforce same-FS staging via `locations.{skills,commands,agents}StagingDir`; install threads `cleanupWarnings` via `runPhases` result |
| PI-9  | Order: skills/prompts → agents → MCP → state. Rollback failures surface `(rollback partial: …)` | D-01 5-phase ledger; `formatRollbackError` already composes the marker |
| PI-10 | `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution | `substituteClaudeVars` (`shared/vars.ts`) already invoked by bridges; install passes `pluginRoot` + `pluginDataDir` in StageXInput |
| PI-11 | Agents staged + `pi-subagents` unloaded → canonical warning | `subagentWarningIfNeeded(pi, stagedAgents)` (`presentation/soft-dep.ts:73`) |
| PI-12 | MCP servers staged + `pi-mcp-adapter` unloaded → canonical warning | `mcpAdapterWarningIfNeeded(pi, mcpStaged)` (`presentation/soft-dep.ts:89`) |
| PI-13 | `dependencies` declarations install with manual-install warning | `resolver.ts:454` already adds note `declares dependencies that must be installed manually`; install emits warning when the note is present |
| PI-14 | `PathContainmentError` MUST NOT fold into rollback-partial | D-02 `formatRollbackError` extension |
| PI-15 | Concurrent install detected at state-guard commit rolls back with "was installed concurrently" | Inside `withStateGuard` closure: re-read `state.marketplaces[mp].plugins[plugin]` and throw `ConcurrentInstallError` if non-undefined; outer rollback unwinds via `runPhases` result |
| PU-1  | Order: skills/prompts → agents → MCP → state → data dir | `cascadeUnstagePlugin` order: skills → commands → agents → mcp (`orchestrators/marketplace/shared.ts:151-228`); D-09 reuses |
| PU-2  | Per-plugin data-dir cleanup AFTER state commit | D-08 + outside-the-guard cleanup mirroring remove.ts:150-185 |
| PU-3  | Failures earlier than data-dir abort uninstall with marketplace record intact | cascade returns `UnstageOutcome { ok: false, cause }`; the closure throws (state save SKIPPED -- ST-7 contract) |
| PU-4  | Data-dir cleanup leaks → `warning` severity, leaked path named | `appendLeaks` + `notifyWarning(ctx, formatErrorWithCauses(aggregated))` per remove.ts:195-205 |
| PU-5  | Tolerate concurrent uninstall (silent converge if record already gone at commit) | Inside `withStateGuard` closure: if `state.marketplaces[mp].plugins[plugin] === undefined`, return `ConcurrentUninstallError` sentinel; outer catch surfaces silent success |
| PU-6  | Legacy state records normalize `resources.{agents,mcpServers}` to `[]` | Already handled at load time in `persistence/migrate.ts` (Phase 2 ST-4/ST-5) -- verify in plan, no new code needed |
| PU-7  | Foreign content at agent target → fails loudly, index row retained | `bridges/agents/unstage.ts` already preserves index row + surfaces `failed[]`; `cascadeUnstagePlugin` (`marketplace/shared.ts:184-199`) already throws `AgentsUnstageFailureError` when `agentsResult.failed.length > 0` |
| PU-8  | `Run /reload to drop "<plugin>"` only when ≥1 resource removed | `composeReloadHint(["<plugin>"], "drop")` via `reloadHint` + `appendReloadHint` |
| PUP-1 | Three forms: bare → all installed in scope; `@mp` → all in mp; `pl@mp` → just pl. Empty target → `No plugins installed.` | `updatePlugins(opts)` enumerates targets per scope+marketplace; bare/empty branch emits the marker string + no reload hint |
| PUP-2 | `syncClone` once per marketplace before reading manifest | Per-marketplace memoization in `updatePlugins`: `Map<mpName, Promise<void>>` keyed on (scope, mpName); `gitOps.fetch + checkout` via D-14 sequence in `marketplace/update.ts:393-467` |
| PUP-3 | Resolved version equals recorded → `unchanged`, no I/O | `resolveStrict(entry, ctx).then(...).version === record.version` string equality (no semver); short-circuit before prepare |
| PUP-4 | No longer installable → `skipped` with `no longer installable: <notes>` | `requireInstallable(r, "update")` throws `is no longer installable` per `resolver.ts:548-553`; catch → `partition: "skipped"` |
| PUP-5 | Missing from refreshed manifest → `skipped: not in manifest` | After `syncClone`, re-read marketplace.json; if entry absent → `partition: "skipped", notes: ["not in manifest"]` |
| PUP-6 | Three phases: prepare → state-guard swap → physical replace + soft-dep. Phase-3 failure → recovery hint | D-03 + D-04; `RECOVERY_PLUGIN_REINSTALL_PREFIX` |
| PUP-7 | Phase-3 failure cleans staging without masking original error | D-03 corollary; `abort*` per handle + `cleanupStaging` per stagingDir; `appendLeakToError` |
| PUP-8 | Reload hint emitted when ≥1 plugin actually updated | `reloadHint("refresh", updatedNames)` |
| PUP-9 | Direct `update` throws → `error` severity; cascade → `partition: 'failed'` | `updatePlugins` catches outer throws and routes by `opts.calledFromCascade?` flag (or by which entry-point is wired); `updateSinglePlugin` always returns an outcome (never throws to its caller, the cascade) |
| PL-1  | No flags shows every bucket; flags select union | Filter chain in `list.ts` |
| PL-2  | No marketplace name → nested tree grouped by scope | Render payload `{ scope, marketplaces: [{...}] }` |
| PL-3  | With marketplace name → only that marketplace | Filter narrowing in orchestrator |
| PL-4  | Icon (●/○/⊘) + name + `(<version>)` + status + col-66 truncated description | `presentation/plugin-list.ts` private formatters |
| PL-5  | `upgradable` iff manifest version differs (string compare) | `manifest.version !== installRecord.version` (no semver) |
| PL-6  | Manifest load failure → `[warning] could not load manifest: <reason>`, STILL renders installed plugins | try/catch around manifest read per marketplace; soft-fail emits warning line into payload, install records still rendered |
| PL-7  | Per-marketplace headers include `[autoupdate]` tag | `record.autoupdate === true ? " [autoupdate]" : ""` (mirror `marketplace-list.ts:65`) |
| RN-3  | Cross-plugin install conflict guard BEFORE any disk write; one message | D-05 |
| AS-2  | Install order: skills/prompts → agents → MCP → state | D-01 |
| AS-3  | Update three-phase: prepare → state-guard swap (old-resource snapshot) → physical replace + soft-dep | D-03 |
| AS-6  | Post-commit cleanup leaks → `cleanupWarnings`, severity bump to `warning`, state committed | D-08 |
| AS-7  | Specific guidance when install rollback leaves orphan agent index entries | New error message in `install.ts` rollback path; reuse `agentsResult.failed[]` shape |
| NFR-2 | No fix requires Pi restart | All paths idempotent + `/reload` sufficient (architectural -- tests check no `process.exit`, no global state reload) |
| NFR-3 | Operations safe to retry on transient failure (idempotent or fail-clean) | Atomic staging + rollback contract; uninstall idempotent (bridges already ENOENT-tolerant) |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-plugin name conflict guard (PI-6 / RN-3) | `orchestrators/plugin/` | `domain/name.ts` (input computation) | Reads state -- orchestrator-shaped; PRD §6.5 RN-3 says "BEFORE any disk write", which only the orchestrator can guarantee |
| Cross-marketplace agent ownership (RN-4) | `bridges/agents/` | -- | Already enforced by `prepareStagePluginAgents` via `findOwnershipConflicts`; Phase 5 does not duplicate |
| MC-4 MCP cross-slot collision | `bridges/mcp/` | -- | Bridge-enforced via `loadEffectiveServerNames` and `McpServerCollisionError` |
| 5-phase install ledger composition | `orchestrators/plugin/install.ts` | `transaction/phase-ledger.ts` | Literal-array discipline (Phase 2 D-01) lives at the call site |
| PI-14 PathContainmentError bypass | `transaction/rollback.ts` | `shared/errors.ts` (subclass surface) | D-02 single chokepoint |
| 3-phase update sequence | `orchestrators/plugin/update.ts` | `withStateGuard` (closure) | Heterogeneous-undo flow → hand-rolled (Phase 4 D-02 precedent) |
| `syncClone` per-marketplace memo (PUP-2) | `orchestrators/plugin/update.ts` (or shared in `orchestrators/plugin/shared.ts`) | Phase 4 `GitOps.fetch/forceUpdateRef/checkout` | Update orchestrator owns ordering; gitOps owns mechanics |
| State commit (last ledger phase) | `transaction/with-state-guard.ts` | `persistence/state-io.ts` | Guard saves on no-throw; state-commit phase is the trigger inside the closure |
| Per-plugin data dir lifecycle | `orchestrators/plugin/{install,uninstall}.ts` | `persistence/locations.ts` (`pluginDataDir(mp, plugin)`) | Created post-state-commit (install), removed post-state-commit (uninstall) |
| Foreign-content detection (PU-7) | `bridges/agents/{marker,unstage,stage}.ts` | `cascadeUnstagePlugin` (rethrow) | Already in place -- `isOwnedAgentFile` + `failed[]` channel |
| Top-level `list` filtering + manifest soft-fail (PL-6) | `orchestrators/plugin/list.ts` | `domain/manifest.ts` validator | Orchestrator reads + soft-fails |
| Top-level `list` rendering (PL-4 icons, col-66, autoupdate tag) | `presentation/plugin-list.ts` | -- | Pure formatter; PL-3 D-06 split |
| Resolver array-shape change (COMP-01) | `domain/resolver.ts` | `bridges/{skills,commands,agents}/discover.ts` (consumption) | D-07 |
| Reload hint composition | `presentation/reload-hint.ts` | `shared/markers.ts` (RELOAD_HINT_PREFIX) | Already in place |
| Soft-dep warning composition (RH-3/4/5) | `presentation/soft-dep.ts` | `shared/markers.ts` (PI_SUBAGENTS_NOT_LOADED / PI_MCP_ADAPTER_NOT_LOADED) | Already in place; install/update call `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` |

---

## Standard Stack (carried forward from Phases 1-4)

### Core (no changes)

| Library | Version | Purpose |
|---------|---------|---------|
| Node.js | `>=22.18` | TypeScript native strip; engines per CLAUDE.md |
| TypeScript | `^5.9.3` | Strict mode; discriminated unions (NFR-7) |
| typebox | `^1.1.38` | Schemas; the `ComponentPathsSchema` array change preserves JIT compile shape (readonly array of strings) |
| `@mariozechner/pi-coding-agent` | `>=0.70.6` (peer) | `ExtensionContext` + `ExtensionAPI` types; `getAllTools()` on `ExtensionAPI` not `ExtensionContext` (see soft-dep.ts header note) |
| write-file-atomic | `^8.0.0` | Wrapped by `shared/atomic-json.ts` (state.json + mcp.json + agents-index.json) |
| node:fs/promises | bundled | All file operations |
| node:crypto | bundled | `randomUUID` for staging dirs; SHA-256 (already in `domain/version.ts`) |
| node:test | bundled | Test runner (no Jest/Vitest) |

Phase 5 introduces no new runtime libraries.

### Phase 5-internal additions

- `RECOVERY_PLUGIN_REINSTALL_PREFIX` string constant in `shared/markers.ts` (D-04).
- Four new error classes in `shared/errors.ts` (D-02 corollary listing: `CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError`, `PluginUpdatePhase3Error`). Plus the planner may want `AlreadyInstalledError` for PI-5 and `PluginNotInManifestError` for PI-3 / PUP-5 if they need typed catch sites in tests -- both are optional (a plain `Error` with the canonical message works equally well; Phase 4 used typed errors for `MarketplaceDuplicateNameError`, `MarketplaceNotFoundError`, etc., setting a precedent).

---

## Architecture Patterns

### System Architecture Diagram (data flow)

```
                            ┌─────────────────────┐
   /claude:plugin install   │  Phase 6 edge/      │   parses args, validates --scope
   /claude:plugin uninstall │  router.ts          │   constructs ctx, gitOps, pi
   /claude:plugin update    │                     │
   /claude:plugin list      └──────────┬──────────┘
                                       │   (plugin, marketplace, scope, cwd, ctx, pi, gitOps)
                                       ▼
                            ┌─────────────────────┐
                            │ orchestrators/      │
                            │ plugin/             │
                            │   install.ts        │── reads state, computes generated names
                            │   uninstall.ts      │── calls assertNoCrossPluginConflicts (PI-6)
                            │   update.ts         │── builds Phase<InstallCtx>[] literal
                            │   list.ts           │── runs withStateGuard(runPhases(...))
                            │   shared.ts         │── PI-6 guard, syncClone memo
                            └────┬───────┬────────┘
                                 │       │
                ┌────────────────┘       └───────────────┐
                ▼                                        ▼
   ┌─────────────────────┐                  ┌─────────────────────┐
   │ transaction/        │                  │ bridges/            │
   │   phase-ledger.ts   │                  │   skills/  → prep/commit/abort/unstage
   │   rollback.ts       │                  │   commands/→ prep/commit/abort/unstage
   │   with-state-guard  │                  │   agents/  → prep/commit/abort/unstage
   └──────┬──────────────┘                  │   mcp/     → prep/commit/abort/unstage
          │  formatRollbackError            └────────┬────────────┘
          │  (PI-14 bypass -- D-02)                   │
          ▼                                          ▼
   ┌─────────────────────┐                  ┌─────────────────────┐
   │ persistence/        │                  │ shared/             │
   │   state-io.ts       │                  │   markers.ts        │  ← + RECOVERY_PLUGIN_REINSTALL_PREFIX
   │   locations.ts      │                  │   errors.ts         │  ← + 4 new classes
   │   agents-index-io   │                  │   notify.ts         │
   │   migrate.ts        │                  │   atomic-json.ts    │
   └─────────────────────┘                  │   fs-utils.ts       │
                                            │   path-safety.ts    │
                                            └─────────────────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────────┐
                                            │ presentation/       │
                                            │   reload-hint.ts    │
                                            │   soft-dep.ts       │
                                            │   marketplace-list  │
                                            │   plugin-list.ts    │  ← NEW (D-06)
                                            └─────────────────────┘
                                                     │
                                                     ▼
                                            ctx.ui.notify(message, severity)
                                              via shared/notify.ts
```

### Component Responsibilities (Phase 5 surface)

| File (path absolute under `extensions/claude-marketplace/`) | New / Modified | Lines (est.) | Purpose |
|------|----------------|-----:|---------|
| `orchestrators/plugin/install.ts` | NEW | ~260 | 5-phase ledger; PI-1..15; rollback via runPhases + formatRollbackError; eager `pluginDataDir` mkdir post-state-commit |
| `orchestrators/plugin/uninstall.ts` | NEW | ~140 | Reuses `cascadeUnstagePlugin`; PU-1..8; data-dir rm-rf post-state-commit; concurrent-converge sentinel |
| `orchestrators/plugin/update.ts` | NEW | ~330 | Hand-rolled 3-phase swap; `updateSinglePlugin: PluginUpdateFn` + `updatePlugins(opts)`; syncClone memo; PUP-1..9 |
| `orchestrators/plugin/list.ts` | NEW | ~120 | PL-1..7 orchestrator; manifest soft-fail per marketplace; emits payload to `renderPluginList` |
| `orchestrators/plugin/shared.ts` | NEW | ~180 | `assertNoCrossPluginConflicts`; potentially `syncCloneOnce` memo helper; types for `InstallCtx` / `Phase3Failure` if widely used |
| `presentation/plugin-list.ts` | NEW | ~150 | Pure formatter; private `truncateColumn66`, `iconFor`, `renderPluginEntry`; PL-4 icon table |
| `domain/resolver.ts` | MODIFIED | ~+20/-10 | `ComponentPathsSchema` → readonly-string-array; strict resolver Step 7 union logic; loose resolver remains entry-only |
| `bridges/skills/discover.ts` | MODIFIED | ~+15/-5 | for-of over `componentPaths.skills: readonly string[]`; first-wins dedup with warning to `failed[]` |
| `bridges/commands/discover.ts` | MODIFIED | ~+15/-5 | Same |
| `bridges/agents/discover.ts` | MODIFIED | ~+15/-5 | Same (agentsDir input becomes plural; orchestrators pass per-path call) |
| `bridges/{skills,commands,agents}/types.ts` | MODIFIED | ~+5 each | `componentPaths` field types updated if locally typed; resolver export drives most of this |
| `shared/markers.ts` | MODIFIED | +1 line | `RECOVERY_PLUGIN_REINSTALL_PREFIX` |
| `shared/errors.ts` | MODIFIED | ~+60 | 4 new error classes |
| `transaction/rollback.ts` | MODIFIED | ~+10 | `instanceof PathContainmentError` short-circuit (D-02) |
| `tests/architecture/markers-snapshot.test.ts` | MODIFIED | +1 case | PUP-6 prefix-equivalence |
| `tests/transaction/rollback.test.ts` | MODIFIED | +2 cases | PI-14 bypass + SymlinkRefusedError subclass |
| `tests/orchestrators/plugin/install.test.ts` | NEW | ~600 | PI-1..15 + AS-6/AS-7 + concurrent install (PI-15) |
| `tests/orchestrators/plugin/uninstall.test.ts` | NEW | ~400 | PU-1..8 |
| `tests/orchestrators/plugin/update.test.ts` | NEW | ~600 | PUP-1..9 |
| `tests/orchestrators/plugin/list.test.ts` | NEW | ~350 | PL-1..7 (orchestrator-level) |
| `tests/orchestrators/plugin/shared.test.ts` | NEW | ~150 | `assertNoCrossPluginConflicts` 5 cases |
| `tests/presentation/plugin-list.test.ts` | NEW | ~250 | Truncation, icon legend, payload round-trip |
| `tests/domain/resolver-comp01.test.ts` | NEW | ~200 | COMP-01 supplement-not-replace via 3 fixture plugins |
| `tests/domain/resolver-strict.test.ts` | MODIFIED | ~+5/-5 | Existing tests asserting single-string `componentPaths.skills` need update to array semantics |
| `tests/domain/resolver-loose.test.ts` | MODIFIED | ~+5/-5 | Same |
| `tests/persistence/locations.test.ts` | MODIFIED | +1 case | `pluginDataDir(mp, plugin)` already exists; add containment escape case if not covered |
| `extensions/claude-marketplace/orchestrators/index.ts` | MODIFIED | +4 lines | Barrel re-exports |
| `REQUIREMENTS.md` | MODIFIED | 1 line | PR-4 strikethrough |
| `.planning/PROJECT.md` | MODIFIED | +1 row | D-24 (COMP-01 supersession) |
| `CHANGELOG.md` (or equivalent in `docs/`) | NEW/MODIFIED | +1 entry | "behavior corrected vs. V1: custom component-path arrays now SUPPLEMENT defaults" |

### Pattern 1: Hand-rolled 3-phase update (D-03)

```typescript
// orchestrators/plugin/update.ts (sketch -- verify against actual implementation)
async function updateOnePluginThreePhase(ctx: UpdateCtx): Promise<PluginUpdateOutcome> {
  // PHASE 1: prepare into bridge-local tmp
  const prepHandles: PrepHandles = {};
  try {
    prepHandles.skills = await prepareStageSkills({ locations, ...skillsInput });
    prepHandles.commands = await prepareStageCommands({ locations, ...commandsInput });
    prepHandles.agents = await prepareStagePluginAgents({ locations, ...agentsInput });
    prepHandles.mcp = await prepareStageMcpServers({ locations, ...mcpInput });
  } catch (err) {
    // Abort already-prepared handles (idempotent)
    const leaks: (string | undefined)[] = [];
    if (prepHandles.mcp) abortPreparedMcp(prepHandles.mcp);
    if (prepHandles.agents) leaks.push(await abortPreparedAgents(prepHandles.agents));
    if (prepHandles.commands) await abortPreparedCommands(prepHandles.commands);
    if (prepHandles.skills) await abortPreparedSkills(prepHandles.skills);
    throw appendLeaks(err, leaks);
  }

  // PHASE 2: state-guard swap (capture old snapshot inside guard window)
  let oldResources: ExtensionState["marketplaces"][string]["plugins"][string]["resources"];
  try {
    await withStateGuard(locations, async (state) => {
      const record = state.marketplaces[mp].plugins[pluginName];
      if (record === undefined) throw new ConcurrentChangeError(`Plugin "${pluginName}" was removed concurrently.`);
      if (record.version !== fromVersion) throw new ConcurrentChangeError(`Plugin "${pluginName}" changed concurrently; retry the update.`);
      oldResources = record.resources;
      record.resources = {
        skills: prepHandles.skills.result.recorded.map(r => r.generatedName),
        prompts: prepHandles.commands.result.recorded.map(r => r.generatedName),
        agents: prepHandles.agents.result.recorded.map(r => r.generatedName),
        mcpServers: prepHandles.mcp.result.recorded.map(r => r.generatedName),
      };
      record.version = toVersion;
      record.updatedAt = new Date().toISOString();
    });
  } catch (err) {
    // Abort + cleanup; original error not masked
    abortAll(prepHandles);
    throw err;
  }

  // PHASE 3a: physical replace, aggregate failures across bridges (continue, don't fail-fast)
  const phase3aFailures: Phase3Failure[] = [];
  for (const [bridgeKey, commit] of [
    ["skills",   () => commitPreparedSkills(prepHandles.skills)],
    ["commands", () => commitPreparedCommands(prepHandles.commands)],
    ["agents",   () => commitPreparedAgents(prepHandles.agents)],
    ["mcp",      () => commitPreparedMcp(prepHandles.mcp)],
  ] as const) {
    try { await commit(); }
    catch (err) { phase3aFailures.push({ phase: bridgeKey, msg: errorMessage(err), cause: err }); }
  }

  // PHASE 3b: soft-dep warning composition (only fires when phase-3a succeeded for that kind)
  const subagentWarn = subagentWarningIfNeeded(pi, oldResources.agents); // … or staged names
  const mcpWarn = mcpAdapterWarningIfNeeded(pi, oldResources.mcpServers);

  if (phase3aFailures.length > 0) {
    const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${pluginName}".`;
    const aggregate = new PluginUpdatePhase3Error(
      `Plugin "${pluginName}" update failed during physical replace.\n${recoveryHint}`,
      phase3aFailures,
    );
    notifyError(ctx, formatErrorWithCauses(aggregate), aggregate);
    return { partition: "failed", name: pluginName, notes: [errorMessage(aggregate)] };
  }

  return {
    partition: "updated",
    name: pluginName,
    fromVersion,
    toVersion,
    stagedAgents: prepHandles.agents.result.recorded.map(r => r.generatedName),
    stagedMcpServers: prepHandles.mcp.result.recorded.map(r => r.generatedName),
  };
}
```

### Pattern 2: 5-phase install ledger composition (D-01)

```typescript
// orchestrators/plugin/install.ts (sketch)
interface InstallCtx {
  scope: Scope;
  locations: ScopedLocations;
  marketplace: string;
  plugin: string;
  manifest: PluginManifest;
  resolved: ResolvedPluginInstallable;
  prepHandles: {
    skills?: PreparedSkillsStaging;
    commands?: PreparedCommandsStaging;
    agents?: PreparedAgentsStaging;
    mcp?: PreparedMcpStaging;
  };
  stateSnapshot: ExtensionState;
  // … plus version, pluginDataDir, sourcePath etc.
}

const phases: readonly Phase<InstallCtx>[] = [
  {
    name: "skills",
    do: async (c) => {
      c.prepHandles.skills = await prepareStageSkills({ locations: c.locations, /*…*/ });
      await commitPreparedSkills(c.prepHandles.skills);
    },
    undo: async (c) => {
      if (c.prepHandles.skills) {
        await unstagePluginSkills({ locations: c.locations, previousSkillNames: c.prepHandles.skills.result.stagedNames });
      }
    },
  },
  { name: "commands", do: /* … */, undo: /* … */ },
  { name: "agents",   do: /* … */, undo: /* … */ },
  { name: "mcp",      do: /* … */, undo: /* … */ },
  {
    name: "state",
    do: async (c) => {
      // The state-commit phase is the trigger inside the withStateGuard closure;
      // saveState is called by the guard on no-throw. This phase is mostly a noop
      // marker for ledger ordering; the mutation happened in earlier phases that
      // wrote into c.stateSnapshot. Concrete: it does the final stateSnapshot
      // assertion + concurrent-install check (PI-15).
      const record = c.stateSnapshot.marketplaces[c.marketplace];
      if (record === undefined) throw new MarketplaceNotFoundError(c.marketplace, [c.scope]);
      if (record.plugins[c.plugin] !== undefined) throw new ConcurrentInstallError(/* PI-15 */);
      record.plugins[c.plugin] = {
        version, resolvedSource, compatibility, resources, installedAt, updatedAt
      };
      // saveState fires when the outer guard's closure returns.
    },
    // undo: noop -- state guard's ST-7 contract means saveState only happens on no-throw
  },
];

await withStateGuard(locations, async (state) => {
  const ctx: InstallCtx = { /* … */, stateSnapshot: state };
  const result = await runPhases(phases, ctx);
  if (!result.ok) throw formatRollbackError(result, result.error!);
});

// Post-state-commit: eager mkdir of pluginDataDir (D-08).
// Failure here is a WARNING-severity post-commit leak; does NOT roll back.
try { await mkdir(await locations.pluginDataDir(marketplace, plugin), { recursive: true }); }
catch (err) { notifyWarning(ctx, `Plugin "${plugin}" installed; data dir creation deferred: ${errorMessage(err)}`); }
```

### Pattern 3: `assertNoCrossPluginConflicts` (D-05)

```typescript
// orchestrators/plugin/shared.ts (sketch)
export function assertNoCrossPluginConflicts(
  scope: Scope,
  generatedNames: { skills: readonly string[]; commands: readonly string[]; agents: readonly string[] },
  state: ExtensionState,
): void {
  const conflicts: string[] = [];

  // Build maps: kind -> Map<generatedName, owningPluginName>
  const seen = { skills: new Map<string, string>(), commands: new Map<string, string>(), agents: new Map<string, string>() };
  for (const mp of Object.values(state.marketplaces)) {
    for (const [pluginName, plugin] of Object.entries(mp.plugins)) {
      for (const n of plugin.resources.skills)   seen.skills.set(n, pluginName);
      for (const n of plugin.resources.prompts)  seen.commands.set(n, pluginName);
      for (const n of plugin.resources.agents)   seen.agents.set(n, pluginName);
      // MCP EXCLUDED per PRD §6.5
    }
  }

  // Check new names per kind in deterministic order: skills → commands → agents; alphabetical within kind
  for (const n of [...generatedNames.skills].sort())   if (seen.skills.has(n))   conflicts.push(`skill "${n}" already owned by plugin "${seen.skills.get(n)!}"`);
  for (const n of [...generatedNames.commands].sort()) if (seen.commands.has(n)) conflicts.push(`command "${n}" already owned by plugin "${seen.commands.get(n)!}"`);
  for (const n of [...generatedNames.agents].sort())   if (seen.agents.has(n))   conflicts.push(`agent "${n}" already owned by plugin "${seen.agents.get(n)!}"`);

  if (conflicts.length > 0) throw new CrossPluginConflictError(conflicts);
}
```

### Pattern 4: Uninstall closure with silent-converge (D-09)

```typescript
// orchestrators/plugin/uninstall.ts (sketch)
let alreadyGone = false;
let outcome: UnstageOutcome | undefined;

try {
  await withStateGuard(locations, async (state) => {
    const record = state.marketplaces[marketplace];
    if (record === undefined) {
      alreadyGone = true;
      return;
    }
    const plugin = record.plugins[pluginName];
    if (plugin === undefined) {
      // PU-5 silent converge: another process already uninstalled
      alreadyGone = true;
      return;
    }
    outcome = await cascadeUnstagePlugin(pluginName, marketplace, locations, plugin);
    if (!outcome.ok) {
      // Bridge cascade failed (e.g., AG-5 foreign content → AgentsUnstageFailureError)
      throw outcome.cause!;
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete record.plugins[pluginName];
  });
} catch (err) {
  // PU-3: marketplace record intact (state guard didn't save)
  notifyError(ctx, formatErrorWithCauses(err), err);
  return;
}

if (alreadyGone) {
  // PU-5: silent converge. No notification by spec; the install was already gone.
  // (CONTEXT.md says "silent converge" -- reading PRD §5.2.2 PU-5 confirms; OPEN QUESTION: should
  // there still be a non-error success notification? Default to silence per literal "silent converge".)
  return;
}

// Post-state-commit data-dir cleanup (D-08, PU-2/PU-4)
const leaks: string[] = [];
try { await rm(await locations.pluginDataDir(marketplace, pluginName), { recursive: true, force: true }); }
catch (err) { leaks.push(`plugin data dir: ${errorMessage(err)}`); }

// PU-8 reload hint only when ≥1 resource removed
const anyDropped =
  outcome!.dropped.skills.length > 0 ||
  outcome!.dropped.commands.length > 0 ||
  outcome!.dropped.agents.length > 0 ||
  outcome!.dropped.mcpServers.length > 0;
const hint = reloadHint("drop", anyDropped ? [pluginName] : []);

let body = `Uninstalled plugin "${pluginName}" from marketplace "${marketplace}".`;
if (leaks.length > 0) {
  body = `${body}\n${leaks.join("\n")}`;
  notifyWarning(ctx, appendReloadHint(body, hint));
  return;
}
notifySuccess(ctx, appendReloadHint(body, hint));
```

### Anti-Patterns to Avoid

- **DO NOT** import from `orchestrators/marketplace/*` into `orchestrators/plugin/*` EXCEPT for `cascadeUnstagePlugin`, `GitOps`, `DEFAULT_GIT_OPS`, `resolveScopeFromState`, `formatErrorWithCauses`. Anything else needs to live in `orchestrators/types.ts` (Phase 4 D-06 elevation rule) or be duplicated.
- **DO NOT** introduce a cycle: `orchestrators/marketplace/` MUST NOT import from `orchestrators/plugin/`. Phase 4's autoupdate cascade uses the injected `PluginUpdateFn` only.
- **DO NOT** call `ctx.ui.notify` directly from any new orchestrator file. ESLint `no-restricted-syntax` rule (`shared/notify.ts` is the only sanctioned site).
- **DO NOT** inline the marker strings. `RELOAD_HINT_PREFIX`, `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `ROLLBACK_PARTIAL`, `MANUAL_RECOVERY_REQUIRED`, and the new `RECOVERY_PLUGIN_REINSTALL_PREFIX` are sourced from `shared/markers.ts`. The markers-snapshot test catches drift.
- **DO NOT** read state in a closure not wrapped by `withStateGuard` when the goal is to mutate. ST-7 contract: load fresh, mutate, save only on no-throw.
- **DO NOT** call `gitOps.*` from `install.ts` or `list.ts`. PI-2 and PL-3 require asymmetry with `update`. Architectural tests should grep these files for `gitOps` / `DEFAULT_GIT_OPS` / `platform/git` and fail (precedent: `tests/orchestrators/marketplace/list.test.ts:198-207` does this for `marketplace list`).
- **DO NOT** use `runPhases<UpdateCtx>` for the 3-phase update. D-03 + Discussion-Log Q1 of "Update 3-phase atomic swap" explicitly reject this -- heterogeneous undo semantics + `rollback partial:` would fire incorrectly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Reverse-order undo on first throw | Imperative try/catch tree per orchestrator | `runPhases<C>(phases, ctx)` (`transaction/phase-ledger.ts:66`) |
| `(rollback partial: …)` formatting + PI-14 bypass | inline `instanceof` check at every catch | `formatRollbackError(result, error)` (`transaction/rollback.ts:30`); extend ONCE for D-02 |
| Single chokepoint for ES-5 markers | Inline literals | `shared/markers.ts` (5 existing constants; add 1) |
| Error.cause chain walking (depth 5) | Per-orchestrator reducers | `formatErrorWithCauses(err, 5)` (`orchestrators/marketplace/shared.ts:339`) |
| Soft-dep probe + canonical warning composition | Per-orchestrator `pi.getAllTools().some(...)` | `subagentWarningIfNeeded(pi, names)` / `mcpAdapterWarningIfNeeded(pi, names)` (`presentation/soft-dep.ts:73, 89`) |
| Reload hint formatting (RH-1 / RH-2) | Inline string construction | `reloadHint(verb, names)` + `appendReloadHint(body, hint)` (`presentation/reload-hint.ts:29, 46`) |
| Per-plugin 4-bridge unstage loop | Re-implement in uninstall.ts | `cascadeUnstagePlugin(...)` (`orchestrators/marketplace/shared.ts:151`) -- D-09 |
| `path.join` + containment check on plugin data dir | Manual `path.join` + `assertPathInside` | `locations.pluginDataDir(mp, plugin)` (`persistence/locations.ts:132`) -- returns Promise |
| Atomic JSON file write | `fs.writeFile(tmp)` + `fs.rename` boilerplate | `atomicWriteJson(path, value)` (`shared/atomic-json.ts`) |
| Staging-dir cleanup with leak message | Try/catch + manual error wrap | `cleanupStaging(dir, label)` + `appendLeakToError(err, leak)` (`shared/fs-utils.ts:31` + `shared/errors.ts:16`) |
| PI-7 version computation (SHA-256, 12-char truncate, walk filter) | Re-implement | `computeHashVersion(pluginRoot)` (`domain/version.ts:30`) + `HASH_WALK_SKIP` |
| `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution | Per-bridge string replace | `substituteClaudeVars(content, {pluginRoot, pluginData})` (`shared/vars.ts`) -- already invoked by bridges |
| Direct `ctx.ui.notify` calls | Magic-string severity | `notifySuccess`/`notifyWarning`/`notifyError(ctx, msg, cause?)` (`shared/notify.ts`) |
| Foreign-content detection at agent target | Filename + content scan | `isOwnedAgentFile(targetPath)` (`bridges/agents/marker.ts:41`) |
| Cross-marketplace agent ownership check (RN-4) | Re-implement in install | `findOwnershipConflicts` + `partitionByOwner` (`bridges/agents/index-mutation.ts` via `prepareStagePluginAgents`) |
| MCP cross-slot collision (MC-4 / RN-5) | Manual probe | `loadEffectiveServerNames(cwd)` + `McpServerCollisionError` (`bridges/mcp/collision-slots.ts`, `bridges/mcp/stage.ts:117-133`) |
| Plugin source classification | Re-parse | `parsePluginSource(raw)` (`domain/source.ts`) -- but Phase 5 doesn't see raw strings; the resolver is already invoked |

**Key insight:** Everything Phase 5 needs is already a primitive in Phases 1-4. The phase's net new code is mostly *composition* (the 4 orchestrators) plus the resolver array migration (COMP-01) plus 3 small extensions (markers + rollback bypass + errors).

---

## Common Pitfalls

### Pitfall 1: Aborting un-prepared handles in update.ts phase-1 failure path

**What goes wrong:** Phase-1 of update prepares 4 bridge handles sequentially. If the 3rd (`agents`) throws, the cleanup path must abort `skills` and `commands` (which DID prepare) but NOT `agents` or `mcp` (which never prepared).

**Why it happens:** The `prepHandles` object accumulates partial state; calling `abortPreparedAgents(undefined)` would NPE.

**How to avoid:** Use `if (prepHandles.X !== undefined)` guards before each `abortPrepared*` call. `abortPreparedMcp` is sync void; the others are async returning `string | undefined` for leak descriptors. Accumulate leaks; `throw appendLeaks(err, leaks)` to preserve the original cause.

**Warning signs:** Test that injects a throw at the 2nd, 3rd, and 4th prepare position; asserts only earlier handles are aborted and the original error message survives.

### Pitfall 2: PI-15 concurrent install detected AFTER ledger phases ran

**What goes wrong:** The 5-phase ledger runs skills → commands → agents → mcp → state. Between when the install computed generated names and when the state-commit phase enters its closure, another process could have inserted the plugin record. The state-commit phase's check would then trigger rollback -- but agents bridge has ALREADY committed (atomic rename done, agents-index.json saved).

**Why it happens:** The state-commit phase is the LAST ledger entry; bridge commits already happened in earlier phases.

**How to avoid:** Two options:
1. **Detect early:** Make the state-commit phase the FIRST sanity check inside the withStateGuard closure, BEFORE the ledger runs. Then ledger phases trust the state to be intact.
2. **Accept the rollback:** Let the ledger's reverse-order undo path call each bridge's unstage. This works correctly per `runPhases` semantics, but the agents-index.json is written-and-then-rewritten. CONTEXT.md D-01 says state-commit is the terminal phase with `undo: noop` -- implying option 2.

**Recommended:** Option 2 + add an early sanity check OUTSIDE the ledger (inside the withStateGuard closure but BEFORE `runPhases`) that throws `ConcurrentInstallError` if `state.marketplaces[mp].plugins[plugin] !== undefined`. This catches the common case without permitting the rare race that does require full rollback.

**Warning signs:** Test that pre-populates state, calls install, asserts `ConcurrentInstallError` is thrown and that the agents-index.json and skills target dirs are NOT modified post-throw.

### Pitfall 3: Update phase-3a failure leaves state pointing at new names but disk has old

**What goes wrong:** Phase-2 (state-guard swap) commits new resource names to state.json. Phase-3a (physical replace) tries to commit each bridge's prepared handle. If skills bridge commits successfully but agents bridge fails, the state says "agents are at new names" but the agents-index.json still points at the old (un-replaced) targets.

**Why it happens:** Phase-2 is one atomic state.json write; phase-3a is four sequential disk operations. There's no rollback layer covering the gap.

**How to avoid:** The PUP-6 recovery hint exists precisely for this case. CONTEXT.md D-03 says "On ANY phase-3a failure: emit `error`-severity notification with PUP-6 recovery hint." The user runs `uninstall + install` to recover. The hint message must say WHAT happened (state says new, disk is partial) and WHAT to do (uninstall + reinstall). The on-disk state is best-effort consistent:
- skills target dir may have new content (committed) AND old content (not yet removed); the next uninstall will rm the names listed in state.
- agents-index.json may say "new entries" but the staged files weren't renamed in; the next uninstall's `isOwnedAgentFile` check will skip orphans (failed[] surface).
- mcp.json may have the new server set OR the partial state.

**Warning signs:** Test that injects a throw at the 3rd commit (agents), asserts (a) error severity, (b) recovery hint contains plugin name and the `RECOVERY_PLUGIN_REINSTALL_PREFIX`, (c) cleanupWarnings list any leaked staging dirs, (d) state.json reflects the swap (new names), (e) the install record is NOT removed (user must explicitly uninstall+install).

### Pitfall 4: Stale closure variables in cascade test injection

**What goes wrong:** `removeMarketplace`'s `opts.cascade` injection seam (`orchestrators/marketplace/remove.ts:66`) accepts a function that captures test state. If a test reuses the same `cascade` mock across multiple plugins, the captured `dropped` arrays accumulate across calls instead of being per-plugin.

**Why it happens:** Test ergonomics encourage one `cascade` per test; the orchestrator calls it once per plugin in the marketplace.

**How to avoid:** Each test that injects `cascade` should use a fresh `Map<pluginName, UnstageOutcome>` and a `cascade` function that looks up by `pluginName`. Phase 4's `tests/orchestrators/marketplace/cascade.test.ts` demonstrates the pattern (read it before writing Phase 5 uninstall/update tests).

**Warning signs:** Phase 4 had this -- every cascade test pre-builds the outcome map per test.

### Pitfall 5: D-07 resolver array migration breaks existing strict/loose tests

**What goes wrong:** `tests/domain/resolver-strict.test.ts` and `resolver-loose.test.ts` assert against `componentPaths.skills === "skills"` (string). Phase 5 changes this to `componentPaths.skills: readonly string[] === ["skills"]`. Every existing test that pins the single-string shape will fail.

**Why it happens:** D-07 is a wire-format change to the resolver's public type.

**How to avoid:** Plan the resolver migration as ONE plan (atomic to one PR/commit) that:
1. Changes `ComponentPathsSchema` in `domain/resolver.ts`.
2. Updates `strict resolver Step 7` to union [declared..., implicit-by-convention...] dedup'd.
3. Updates `loose resolver Step 7` to wrap single string in array.
4. Updates ALL existing tests asserting the single-string shape.
5. Updates `bridges/{skills,commands,agents}/discover.ts` to iterate the array.
6. Adds new COMP-01 supplement-not-replace fixture test.
7. Updates `bridges/{skills,commands,agents}/types.ts` if local types embed `componentPaths` (they don't directly -- they only declare `ResolvedPluginInstallable` consumers, which inherits the updated schema).

**State.json migration check:** state.json does NOT persist `componentPaths` (it stores `resources.{skills,prompts,agents,mcpServers}` only -- verified at `persistence/state-io.ts:38-55`). So no `persistence/migrate.ts` migration is needed for COMP-01. Confirmed by reading the PLUGIN_INSTALL_RECORD_SCHEMA at `state-io.ts:38-55`.

**Warning signs:** `npm run check` typecheck fails on existing tests. Plan a single "resolver D-07 + bridge discover.ts + test updates" wave so the change lands atomically.

### Pitfall 6: List orchestrator accidentally triggering manifest reads in the wrong test path

**What goes wrong:** PL-6 says manifest load failure → warning line, STILL render. The orchestrator calls `loadMarketplaceManifest(manifestPath)` per marketplace; if a test mocks state but doesn't create the marketplace.json on disk, every test for `list` would hit ENOENT.

**Why it happens:** PL-5 (upgradable flag) requires the manifest version to compare.

**How to avoid:** The `list` orchestrator should accept an OPTIONAL `manifestLoader` injection seam (mirror Phase 4's `cascade` and `gitOps` patterns). Default to `loadMarketplaceManifest` (which reads `<marketplaceRoot>/.claude-plugin/marketplace.json`). Tests inject a Map<mpName, MarketplaceManifest|Error> for deterministic behavior.

**Warning signs:** Phase 4's `tests/orchestrators/marketplace/list.test.ts` uses real on-disk fixtures (`fixtureMarketplaceDir`); Phase 5's list test corpus has 7 PRD requirements + filter combinations + 2 scopes -- a fixture-only approach scales poorly. Injection wins.

### Pitfall 7: `cascadeUnstagePlugin` `AgentsUnstageFailureError` masking the PU-3 "marketplace record intact" property

**What goes wrong:** `cascadeUnstagePlugin` (`orchestrators/marketplace/shared.ts:184-198`) throws `AgentsUnstageFailureError` when agent unstage `failed[]` is non-empty. In Phase 4's `removeMarketplace`, this lands the plugin in `failedPlugins[]` and the marketplace record is RETAINED (MR-3). In Phase 5's `uninstall`, the same throw must:
1. Surface as `error` severity (PU-7 loud refusal).
2. Leave the plugin record intact (PU-3 retryable).
3. NOT call any data-dir rm-rf.

**Why it happens:** The cascade returns `UnstageOutcome { ok: false, cause }` rather than throwing; only when the caller throws inside the withStateGuard closure does the state mutation get skipped.

**How to avoid:** When `outcome.ok === false`, the uninstall closure MUST throw to skip the `delete record.plugins[pluginName]` step. The outer catch surfaces via `notifyError`. ST-7's "save only on no-throw" preserves the record.

**Warning signs:** Test that pre-stages a foreign agent file at the target, runs uninstall, asserts (a) `error` severity, (b) state.json STILL has the plugin record, (c) pluginDataDir was NOT removed.

### Pitfall 8: Update's syncClone memo cross-marketplace contamination

**What goes wrong:** `updatePlugins({ marketplace: undefined })` enumerates plugins across MULTIPLE marketplaces. The PUP-2 contract says "syncClone once per marketplace". A naive implementation calls `syncClone` inside each plugin's update; the memo prevents redundant calls but only if keyed correctly.

**Why it happens:** Memo key must include both scope and marketplace name; just-the-name keys would collide between scopes.

**How to avoid:**
```typescript
const syncedClones = new Map<`${Scope}:${string}`, Promise<void>>();
async function syncCloneOnce(scope: Scope, mpName: string, gitOps: GitOps, locations: ScopedLocations): Promise<void> {
  const key = `${scope}:${mpName}` as const;
  let p = syncedClones.get(key);
  if (p === undefined) {
    p = (async () => { /* gitOps.fetch + checkout */ })();
    syncedClones.set(key, p);
  }
  await p;
}
```

**Warning signs:** Test that updates 2 plugins from the same marketplace and asserts `gitOps.fetch` was called exactly once with the marketplace's cloneDir.

### Pitfall 9: Phase 4's `marketplace update` cascade and Phase 5's direct update both calling `updateSinglePlugin`

**What goes wrong:** PUP-9 distinguishes "direct (non-cascade)" vs "cascade" failure modes. `updateSinglePlugin: PluginUpdateFn` is the same function for both paths. How does it know which mode it's in?

**Why it happens:** Phase 5 D-09 explicitly says `updateSinglePlugin` is the CASCADE-mode entry point (returns `PluginUpdateOutcome` with `partition: 'failed'` on error). `updatePlugins(opts)` is the DIRECT-mode entry point (catches errors and routes to `notifyError`).

**How to avoid:**
- `updateSinglePlugin: PluginUpdateFn` NEVER throws to its caller. All errors → `outcome.partition = 'failed'`.
- `updatePlugins(opts)` calls `updateSinglePlugin` internally; if a Phase 3a error happens it ALSO emits `notifyError` for direct-mode visibility, but the outcome is still tagged `failed`.
- The Phase 4 autoupdate cascade ONLY consumes `PluginUpdateOutcome[]` (no notify wiring on the cascade side); the user-visible message is composed by the marketplace update orchestrator.

**Warning signs:** Both `updateSinglePlugin` and `updatePlugins` need separate test coverage; ensure the "direct mode notifies error" vs "cascade mode partitions" property is asserted in both.

### Pitfall 10: PathContainmentError bypass in formatRollbackError missing the SymlinkRefusedError subclass

**What goes wrong:** D-02 says PI-14 covers `PathContainmentError`. But `SymlinkRefusedError` is a Phase 1 subclass (per CONTEXT.md Phase 1 D-14..17 reference and `shared/path-safety.ts`). `instanceof PathContainmentError` already returns true for subclass instances in JavaScript -- but the test must explicitly cover this so a future refactor doesn't break it.

**Why it happens:** Easy to forget the subclass relationship; future maintainers might add another path-error subclass.

**How to avoid:** D-02 corollary already specifies: `tests/transaction/rollback.test.ts` gains TWO cases -- `PathContainmentError` AND `SymlinkRefusedError`. Both assert (a) original error returned unwrapped, (b) no `(rollback partial:` substring in message, (c) cause chain intact.

**Warning signs:** Phase 5 verification step should grep all error subclasses of `PathContainmentError` and confirm each has at least one rollback-bypass test case.

### Pitfall 11: PUP-3 "no I/O" assertion in unchanged path

**What goes wrong:** PUP-3 says equal version → `unchanged` partition with NO I/O. But determining "equal version" requires reading the cached manifest (PUP-2 already did the syncClone). After resolveStrict completes, the resolver may have done `stat`/`readFile` of the plugin source dir.

**Why it happens:** PRD §5.2.3 PUP-3 means "no STAGING I/O" -- no bridge prepare, no commit, no state mutation. The resolver's read-only stat/readFile is necessary to compute the version.

**How to avoid:** Document this nuance in the test: `unchanged` outcome means `prepHandles` is empty (no bridge calls) and `state.json` is NOT re-saved. Resolver reads are fine.

**Warning signs:** Test that asserts spy on `prepareStageSkills` is not called for an unchanged plugin.

### Pitfall 12: Update `gitOps.fetch` is the ONLY network gate

**What goes wrong:** PUP-2 says network only for `update` (not install, list, uninstall). NFR-5 enforces this. If `update.ts` somehow imports `gitOps` for a non-syncClone purpose, it leaks.

**How to avoid:** The architectural test pattern from `tests/orchestrators/marketplace/list.test.ts:198-207` greps the source for `platform/git` and `DEFAULT_GIT_OPS` and `gitOps`. Phase 5 should add equivalent tests for `install.ts`, `uninstall.ts`, `list.ts` -- these MUST NOT contain any of those strings (in code, comments allowed).

---

## Runtime State Inventory

**Phase 5 is greenfield code addition + 1 small breaking change to `domain/resolver.ts`.** No rename/refactor/migration of existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | state.json shape stable -- install adds `marketplaces[mp].plugins[<plugin>] = {...}`; uninstall deletes it; update mutates `resources.*` + `version` + `updatedAt`. NO schema change. | none |
| Live service config | None -- no external service registrations | none |
| OS-registered state | None | none |
| Secrets / env vars | None | none |
| Build artifacts | None | none |

**`componentPaths` shape change (D-07) is NOT persisted to state.json** (verified: `PLUGIN_INSTALL_RECORD_SCHEMA` at `persistence/state-io.ts:38-55` stores `resources.{skills,prompts,agents,mcpServers}` only -- these are GENERATED names, not source paths). No migration code path is needed in `persistence/migrate.ts`.

---

## Code Examples

### Update with phase-3a aggregation + recovery hint (verified pattern source)

```typescript
// orchestrators/plugin/update.ts (sketch -- VERIFY against actual implementation)
//
// Phase 3a: continue across bridge commit failures; aggregate.
const phase3aFailures: Array<{ bridge: string; cause: Error }> = [];
let skillsLeak: string | undefined;
let commandsLeak: string | undefined;
let agentsLeak: string | undefined;

for (const step of phase3aSteps) {
  try { await step.commit(); }
  catch (err) {
    phase3aFailures.push({ bridge: step.name, cause: err instanceof Error ? err : new Error(String(err)) });
  }
}

// Phase 3b: soft-dep composition only on success
if (phase3aFailures.length === 0) {
  const subagentWarn = subagentWarningIfNeeded(pi, stagedAgentNames);
  const mcpWarn = mcpAdapterWarningIfNeeded(pi, stagedMcpNames);
  // … notify success body
} else {
  // PUP-6 recovery hint composition
  const tail = phase3aFailures
    .map(f => `[${f.bridge}] ${f.cause.message}`)
    .join("; ");
  const message = `Plugin "${pluginName}" update failed during physical replace: ${tail}\n${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${pluginName}".`;
  // Aggregate causes via Error.cause chain (depth ≤ 5)
  const aggregate = phase3aFailures.reduce<Error>(
    (acc, f) => new Error(acc.message, { cause: f.cause }),
    new Error(message),
  );
  notifyError(ctx, formatErrorWithCauses(aggregate), aggregate);
}
```

### Plugin list rendering payload shape (D-06)

```typescript
// presentation/plugin-list.ts (sketch -- write to taste)
export interface PluginListMarketplaceEntry {
  readonly name: string;
  readonly scope: Scope;
  readonly autoupdate: boolean;
  readonly manifestWarning?: string; // PL-6 soft-fail line
  readonly plugins: readonly PluginListPluginEntry[];
}

export interface PluginListPluginEntry {
  readonly name: string;
  readonly icon: "●" | "○" | "⊘";  // PL-4
  readonly version?: string;
  readonly status?: "installed" | "upgradable" | "not-installable" | "available";
  readonly description?: string;
}

export interface PluginListPayload {
  readonly userMarketplaces: readonly PluginListMarketplaceEntry[];
  readonly projectMarketplaces: readonly PluginListMarketplaceEntry[];
}

const COL_TRUNCATE = 66;

/** Byte-wise truncation per PRD §5.3.1; multi-byte chars handled by byte-count. */
function truncateColumn66(text: string): string {
  if (text.length <= COL_TRUNCATE) return text;
  return text.slice(0, COL_TRUNCATE - 1) + "…";
}

function iconFor(p: PluginListPluginEntry): "●" | "○" | "⊘" {
  switch (p.status) {
    case "installed":      return "●";
    case "upgradable":     return "●";  // still installed
    case "available":      return "○";
    case "not-installable":return "⊘";
    default:               return "○";
  }
}

export function renderPluginList(payload: PluginListPayload): string {
  const lines: string[] = [];
  // … render each scope section grouped by scope; per-marketplace heading with [autoupdate] suffix;
  // per-plugin two-line entry: "  ICON name (version) [marker]\n    truncated description"
  return lines.join("\n");
}
```

### COMP-01 fixture test (D-07 verification)

```typescript
// tests/domain/resolver-comp01.test.ts (sketch)
test("D-07: declared + implicit-by-convention paths UNION (skills)", async () => {
  // Plugin layout:
  //   pluginRoot/skills/              (default -- exists)
  //   pluginRoot/custom/skills/       (declared in entry)
  const result = await resolveStrict(
    { name: "p", source: "./p", skills: "custom/skills" } as PluginEntry,
    { marketplaceRoot, /* stub statKind that says both dirs exist */ }
  );
  assert.equal(result.installable, true);
  assert.deepEqual(result.componentPaths.skills, ["custom/skills", "skills"]);
});

test("D-07: only implicit-by-convention when no declarations (skills)", async () => {
  const result = await resolveStrict(
    { name: "p", source: "./p" } as PluginEntry,
    { marketplaceRoot, /* stub statKind that says default skills/ exists */ }
  );
  assert.deepEqual(result.componentPaths.skills, ["skills"]);
});

test("D-07: only declared when default doesn't exist (skills)", async () => {
  const result = await resolveStrict(
    { name: "p", source: "./p", skills: "custom/skills" } as PluginEntry,
    { marketplaceRoot, /* stub statKind: custom/skills exists, skills/ does not */ }
  );
  assert.deepEqual(result.componentPaths.skills, ["custom/skills"]);
});

test("D-07: loose mode stays entry-only (no union)", async () => {
  // Same plugin layout as test 1, but resolveLoose
  const result = await resolveLoose(
    { name: "p", source: "./p", skills: "custom/skills" } as PluginEntry,
    { marketplaceRoot, /* both dirs exist */ }
  );
  assert.deepEqual(result.componentPaths.skills, ["custom/skills"]); // NO implicit
});
```

### Architectural source-grep for NFR-5 / PI-2

```typescript
// tests/architecture/plugin-orchestrators-no-network.test.ts (NEW -- sketch)
test("PI-2 / NFR-5: install.ts has zero gitOps surface imports", async () => {
  const src = await readFile("extensions/claude-marketplace/orchestrators/plugin/install.ts", "utf8");
  const code = stripComments(src);
  assert.equal(code.includes("platform/git"), false);
  assert.equal(code.includes("DEFAULT_GIT_OPS"), false);
  assert.equal(code.includes("gitOps"), false);
});
// Same for uninstall.ts and list.ts.
// update.ts INTENTIONALLY imports gitOps for PUP-2 syncClone.
```

---

## State of the Art (codebase patterns at phase entry)

| Old Approach | Current Approach (Phase 4 ship) | Phase 5 Action |
|--------------|----------------------------------|----------------|
| V1's `plugin/install.ts` monolith with inline rollback try/catches | Literal-array ledger via `runPhases<C>(phases, ctx)` | Use the ledger; one Phase entry per bridge |
| V1's manual marker strings inlined per call site | `shared/markers.ts` chokepoint + markers-snapshot test | Add `RECOVERY_PLUGIN_REINSTALL_PREFIX` + 1 case |
| V1's mixed `console.log` / `process.stdout` writes | `ctx.ui.notify` via `shared/notify.ts` wrappers only | Route every user-visible message through wrappers |
| V1's `pull --ff-only` for marketplace update | `fetch + forceUpdateRef + checkout` D-14 sequence (Phase 4 D-14) | Update.ts uses the same primitives for syncClone (PUP-2) |
| V1's PR-4 short-circuit (implicit ONLY when manifest absent) | D-07 union semantics (declared + implicit-by-convention, dedup'd) | Implement D-07; supersede PR-4 |
| V1 had no soft-dep WARNING wired into update | Phase 4 update wires `subagent`/`mcpAdapter` WarningIfNeeded with WR-04 staged-name fields | Phase 5 update phase-3b composes same warnings using the actual staged names from prepHandles |
| V1's `cascadeUnstagePlugin` lived inside the marketplace remove flow | Hoisted to `orchestrators/marketplace/shared.ts` for Phase 5 reuse (Phase 4 D-02 corollary) | Import + reuse in uninstall.ts (D-09) |

**Deprecated:**
- V1 PR-4 ("implicit ONLY when manifest field absent") -- superseded by D-07.
- V1 plain-Error throws from bridge prepare paths -- replaced by typed errors (`AgentOwnershipConflictError`, `McpServerCollisionError`, etc.).
- V1 single-string `componentPaths` field shape -- replaced by `readonly string[]` (D-07).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pluginDataDir(mp, plugin)` is a METHOD on `ScopedLocations` returning `Promise<string>` (NOT a free function in `persistence/locations.ts`). Phase 5 consumes the existing method; CONTEXT.md D-08's "new helper `pluginDataDir(loc, mp, plugin)`" is misleading wording -- the method already exists at `persistence/locations.ts:132`. | "Architecture Patterns" / "Don't Hand-Roll" | If CONTEXT.md is taken literally (add a NEW free function), a plan task could redundantly create one. Verify with planner: `pluginDataDir` is already callable via `locations.pluginDataDir(mp, plugin)`. Confirmed by reading `persistence/locations.ts:132-136`. | none -- method is verified present |
| A2 | PU-5 silent converge is literally silent (no notification) when the plugin record was already gone. CONTEXT.md says "silent converge" and "return `{ ok: true, alreadyGone: true }`" but doesn't pin a notification policy. | "Uninstall closure" pattern | Test taxonomy assumed no notification on silent-converge path. If PRD §5.2.2 actually wants a `Plugin "X" was uninstalled by another process.` message, the test will need to update. Read PRD §5.2.2 PU-5 carefully during planning. |
| A3 | `markerss-snapshot.test.ts` (single architectural test) is the only file that needs updating for the new `RECOVERY_PLUGIN_REINSTALL_PREFIX`. CONTEXT.md confirms "Phase 5 extends `tests/architecture/markers-snapshot.test.ts` with one new case". | "Architecture Patterns" | If the snapshot test uses a fixture file (e.g., golden file under `tests/fixtures/`), Phase 5 plan needs to add the new prefix there too. Verify by reading the existing test file before writing the plan. |
| A4 | The `description` field consumed by PL-4 col-66 truncation comes from `state.marketplaces[mp].plugins[].description` OR from the cached manifest's `plugins[].description`. PRD §5.3.1 says "description on second indented line" but doesn't pin source. | "Pattern 4" / list rendering | If description must come from the manifest (always re-read), then PL-6 manifest soft-fail blocks description rendering for that marketplace. If description is persisted to state.json, no soft-fail blockage. State schema (`persistence/state-io.ts:38`) currently does NOT store `description` per plugin. Recommend: read from manifest; on PL-6 soft-fail, omit description. |
| A5 | `dependencies` declarations parsing -- manifest schema `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` accept `dependencies: Type.Optional(Type.Unknown())`. Phase 5 only needs to detect presence (not parse contents). Verified at `domain/components/plugin.ts:55-56`. | "Pattern: install" | none -- schema confirms opaque acceptance |
| A6 | `PluginUpdateOutcome.stagedAgents` and `stagedMcpServers` (WR-04 fields) MUST be populated by Phase 5's `updateSinglePlugin` and `updatePlugins` outcomes so Phase 4's autoupdate cascade can compose RH-5 warnings correctly. Verified at `orchestrators/marketplace/update.ts:332-353`. | "phase-3b soft-dep composition" | If left undefined, Phase 4's autoupdate cascade will skip the soft-dep warnings even when agents/MCP were staged -- a regression vs WR-04. |
| A7 | The PI-7 `hash-<12hex>` version uses bytes from `computeHashVersion(pluginRoot)`. Update's PUP-3 string equality on `manifest.version vs installRecord.version` works for both semver-style and hash-style versions because string equality on equal hash bytes is correct. | "Code Insight" | none -- string equality is universal |
| A8 | `loadMarketplaceManifest` does not yet exist as a named export -- Phase 4 uses inline `readFile + JSON.parse + MARKETPLACE_VALIDATOR.Check` (e.g., `orchestrators/marketplace/update.ts:482-499` `validateManifestAtRoot`). Phase 5's list.ts will need a similar inline approach OR introduce a `loadMarketplaceManifest(manifestPath): Promise<MarketplaceManifest>` helper. | "Pattern 4" / list manifest reads | Plan choice: introduce a named helper for list.ts's PL-6 soft-fail to consume + future Phase 5 update.ts re-read (PUP-5). Recommended: add `domain/manifest.ts::loadMarketplaceManifest(manifestPath): Promise<MarketplaceManifest>` (or `persistence/manifest-io.ts`) as Wave 0 work. The injection seam Pitfall 6 mentions wraps this helper. |
| A9 | The architectural `import-boundaries.test.ts` (`tests/architecture/import-boundaries.test.ts`) covers Phase 5's `orchestrators/plugin/*` boundaries via the same rule as `orchestrators/marketplace/*`. Phase 1 D-11 specifies `orchestrators/` may import from `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. | "Anti-Patterns" | Confirm by reading the existing test file. If `orchestrators/plugin/` needs an explicit allowlist entry, add it. |

**Where verified:** Every `[VERIFIED]` claim in this document corresponds to a file path under `/Users/acolomba/src/pi-claude-marketplace/` that was read in this research session. Where `[ASSUMED]` is unavoidable (A2, A4, A8, A9), the plan-checker should confirm during planning.

---

## Open Questions

1. **PU-5 silent-converge notification policy.**
   - What we know: CONTEXT.md says "silent converge"; PRD §5.2.2 PU-5 (per CONTEXT.md §canonical refs line 95) says "Tolerate concurrent uninstall by another process".
   - What's unclear: Does "silent" mean literally no notification, or a non-error success notification like `Plugin "X" was already uninstalled by another process.`?
   - Recommendation: default to literal silence (no notification) and document explicitly in `uninstall.ts`. Planner reviews PRD §5.2.2 verbatim during plan-checker.

2. **Description source for PL-4 col-66 truncation.**
   - What we know: PRD §5.3.1 mentions "description on second indented line"; description is in the plugin manifest entry (`PluginEntry.description`).
   - What's unclear: Read from manifest each render (PL-6 soft-fail blocks)? Or persist to state.json?
   - Recommendation: Read from manifest; on PL-6 soft-fail, omit the description line for that plugin. Keeps state.json schema stable.

3. **`AlreadyInstalledError` vs plain Error for PI-5.**
   - What we know: PI-5 says "already-installed plugins fail with 'already installed' error".
   - What's unclear: Should this be a typed error class for instanceof catch sites, or just a string-message plain Error?
   - Recommendation: Plain Error with canonical message; tests assert the message substring. Phase 4 set the precedent for typed errors (`MarketplaceDuplicateNameError`) but only because that error had a `.scope` field consumers needed. PI-5 doesn't have structured fields. (If a typed error is added later, it's a no-breaking-change improvement.)

4. **First-wins dedup vs last-wins for COMP-01 array iteration.**
   - What we know: D-07 corollary says "the FIRST wins and the second surfaces as a warning via the bridge's `failed[]` channel".
   - What's unclear: For multi-path component arrays (e.g., `componentPaths.skills === ["custom/skills", "skills"]`), if `custom/skills/foo` and `skills/foo` both exist (same generated name), which one wins?
   - Recommendation: FIRST wins (matches D-07 corollary literal). Test fixture must cover this case.

5. **Architectural test placement for "no gitOps in install/uninstall/list".**
   - What we know: Phase 4's `tests/orchestrators/marketplace/list.test.ts` includes the NFR-5 source-grep tests inline.
   - What's unclear: Should Phase 5 put equivalent tests inline in each orchestrator's test file, OR consolidate into `tests/architecture/no-orchestrator-network.test.ts`?
   - Recommendation: consolidate into one architectural test that parametrically asserts across `install.ts`, `uninstall.ts`, `list.ts` -- easier to keep in sync as the file list grows.

---

## Environment Availability

Phase 5 introduces no new external dependencies. All required primitives are already installed (Node ≥22, typebox, write-file-atomic via `shared/atomic-json.ts`, `@mariozechner/pi-coding-agent` peer dep, node:fs/promises, node:crypto, node:test). No environment audit needed.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json:19`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) with `node --test "tests/**/*.test.ts"` |
| Config file | `package.json` test scripts (no separate config file); ESLint config at `eslint.config.js` |
| Quick run command | `node --test tests/orchestrators/plugin/<file>.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + node:test) |
| Per-test selector | `node --test --test-name-pattern "<regex>"` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| PI-1   | Token parse `<plugin>@<marketplace>` | unit (orchestrator entry-point) | `node --test tests/orchestrators/plugin/install.test.ts` | Wave 2 |
| PI-2   | NO network -- `gitOps` not imported | architectural (source-grep) | `node --test tests/architecture/no-orchestrator-network.test.ts` (NEW) | Wave 0 |
| PI-3   | Not in manifest → exact-text error | unit | install.test.ts | Wave 2 |
| PI-4   | Non-installable → exact-text error | unit | install.test.ts | Wave 2 |
| PI-5   | Already-installed → typed/plain error | unit | install.test.ts | Wave 2 |
| PI-6   | Cross-plugin conflict → CrossPluginConflictError listing every name | unit (shared.ts) | `node --test tests/orchestrators/plugin/shared.test.ts` | Wave 1 |
| PI-7   | Version precedence: manifest > entry > hash | unit | install.test.ts | Wave 2 |
| PI-8   | Same-FS staging; cleanupWarnings surface | unit | install.test.ts | Wave 2 |
| PI-9   | 5-phase order + rollback formatRollbackError | unit (ledger ordering + rollback) | install.test.ts | Wave 2 |
| PI-10  | `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution byte-perfect | integration (bridge fixtures) | install.test.ts | Wave 2 |
| PI-11  | pi-subagents canonical warning when agents + dep unloaded | unit | install.test.ts | Wave 2 |
| PI-12  | pi-mcp-adapter canonical warning when MCP + dep unloaded | unit | install.test.ts | Wave 2 |
| PI-13  | `dependencies` declaration → manual-install warning | unit | install.test.ts | Wave 2 |
| PI-14  | PathContainmentError NEVER folded into rollback-partial | unit (rollback.test.ts) | `node --test tests/transaction/rollback.test.ts` | Wave 0 |
| PI-15  | Concurrent install detected at state-guard → ConcurrentInstallError + rollback | unit | install.test.ts | Wave 2 |
| PU-1   | Uninstall order via spy | unit | uninstall.test.ts | Wave 2 |
| PU-2   | State commit BEFORE data-dir cleanup | unit (spy ordering) | uninstall.test.ts | Wave 2 |
| PU-3   | Earlier-than-data-dir failure → marketplace record intact | unit | uninstall.test.ts | Wave 2 |
| PU-4   | Data-dir leak → warning severity, leaked path named | unit | uninstall.test.ts | Wave 2 |
| PU-5   | Concurrent uninstall → silent converge | unit | uninstall.test.ts | Wave 2 |
| PU-6   | Legacy state migrates to `[]` | unit (verify existing migrate.ts works) | `node --test tests/persistence/migrate.test.ts` | already exists |
| PU-7   | Foreign content → loud refusal | unit | uninstall.test.ts | Wave 2 |
| PU-8   | Reload hint only when ≥1 resource removed | unit | uninstall.test.ts | Wave 2 |
| PUP-1  | Three forms (bare/`@mp`/`pl@mp`) + empty silent success | unit | update.test.ts | Wave 3 |
| PUP-2  | syncClone exactly once per marketplace | unit (mocked GitOps) | update.test.ts | Wave 3 |
| PUP-3  | Unchanged: no I/O, no prepare* calls | unit (spy on prepare) | update.test.ts | Wave 3 |
| PUP-4  | Skipped: no longer installable | unit | update.test.ts | Wave 3 |
| PUP-5  | Skipped: not in manifest | unit | update.test.ts | Wave 3 |
| PUP-6  | Phase-3 failure → RECOVERY_PLUGIN_REINSTALL_PREFIX hint with quoted name | unit | update.test.ts | Wave 3 |
| PUP-7  | Phase-3 abort cleans staging; original error not masked | unit | update.test.ts | Wave 3 |
| PUP-8  | Reload hint when ≥1 updated | unit | update.test.ts | Wave 3 |
| PUP-9  | Direct vs cascade error severity | unit (both entry points) | update.test.ts | Wave 3 |
| PL-1   | No flags → every bucket | unit | list.test.ts | Wave 2 |
| PL-2   | Nested tree grouped by scope | unit | list.test.ts | Wave 2 |
| PL-3   | Marketplace-name narrowing | unit | list.test.ts | Wave 2 |
| PL-4   | Icon table + col-66 truncation | unit (presentation) | `node --test tests/presentation/plugin-list.test.ts` | Wave 1 |
| PL-5   | upgradable string-compare | unit | list.test.ts + plugin-list.test.ts | Wave 1/2 |
| PL-6   | Manifest load failure → warning line, still renders installed plugins | unit | list.test.ts | Wave 2 |
| PL-7   | `[autoupdate]` per-marketplace header tag | unit | list.test.ts + plugin-list.test.ts | Wave 1/2 |
| RN-3   | Pre-disk-write guard + one message | unit | shared.test.ts | Wave 1 |
| AS-2   | Install order skills/prompts → agents → MCP → state | unit (ledger ordering) | install.test.ts | Wave 2 |
| AS-3   | Update 3-phase with old-resource snapshot inside guard | unit | update.test.ts | Wave 3 |
| AS-6   | Post-commit cleanup leak → warning, state committed | unit | install.test.ts | Wave 2 |
| AS-7   | Specific guidance on orphan agent index entries | unit | install.test.ts | Wave 2 |
| NFR-2  | No Pi restart required | architectural (source-grep for process.exit, etc.) | already covered by Phase 1 | already exists |
| NFR-3  | Operations safe to retry | architectural + per-orchestrator test (re-run after partial failure converges) | install.test.ts / uninstall.test.ts | Wave 2 |
| COMP-01| Component-path arrays SUPPLEMENT, not replace | unit (resolver fixture) | `node --test tests/domain/resolver-comp01.test.ts` | Wave 0 |
| D-04   | RECOVERY_PLUGIN_REINSTALL_PREFIX byte-equality with PRD §5.2.3 | architectural | `node --test tests/architecture/markers-snapshot.test.ts` | Wave 0 |
| D-02   | formatRollbackError PI-14 bypass + subclass | unit | `node --test tests/transaction/rollback.test.ts` | Wave 0 |
| D-05 deterministic order | Skills → commands → agents alphabetical | unit | shared.test.ts | Wave 1 |
| D-07 union semantics | resolveStrict 3 fixture cases | unit | resolver-comp01.test.ts | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test "tests/<file>.test.ts"` for the changed file.
- **Per wave merge:** `npm run check` (typecheck + ESLint + Prettier + full test suite).
- **Phase gate:** `npm run check` green; markers-snapshot green; all architectural source-grep tests green.

### Wave 0 Gaps

- [ ] `tests/transaction/rollback.test.ts` -- add PI-14 bypass + SymlinkRefusedError cases (D-02 corollary). Covers PI-14.
- [ ] `tests/architecture/markers-snapshot.test.ts` -- add `RECOVERY_PLUGIN_REINSTALL_PREFIX` case (D-04). Covers D-04.
- [ ] `tests/domain/resolver-comp01.test.ts` -- NEW; 3 fixture cases for D-07 supplement-not-replace (declared only, implicit only, both). Plus updates to `resolver-strict.test.ts` / `resolver-loose.test.ts` for array shape.
- [ ] `tests/architecture/no-orchestrator-network.test.ts` -- NEW; source-grep `install.ts`, `uninstall.ts`, `list.ts` for `gitOps` / `platform/git` / `DEFAULT_GIT_OPS` (must be absent).
- [ ] `tests/domain/resolver-strict.test.ts` -- UPDATE existing tests to assert array shape for `componentPaths.{skills,commands,agents}`.
- [ ] `tests/domain/resolver-loose.test.ts` -- UPDATE same.
- [ ] `tests/persistence/locations.test.ts` -- VERIFY `pluginDataDir` method already covered (CONTEXT.md "specifics" line 238 says add containment escape case if not). Read file before planning to confirm.
- [ ] `shared/markers.ts` -- ADD `RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"`.
- [ ] `shared/errors.ts` -- ADD 4 classes: `CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError`, `PluginUpdatePhase3Error`. Plus `AlreadyInstalledError` if plan-checker prefers typed for PI-5.
- [ ] `transaction/rollback.ts` -- extend `formatRollbackError` with `instanceof PathContainmentError` short-circuit.
- [ ] `domain/resolver.ts` -- D-07 array migration (strict + loose; ComponentPathsSchema).
- [ ] `bridges/skills/discover.ts` -- iterate `componentPaths.skills: readonly string[]`.
- [ ] `bridges/commands/discover.ts` -- same.
- [ ] `bridges/agents/discover.ts` -- same.
- [ ] `domain/manifest.ts` (or `persistence/manifest-io.ts`) -- add `loadMarketplaceManifest(manifestPath)` named export for list.ts soft-fail seam and update.ts re-read (A8 -- verify with plan-checker; this may already exist in a different name).

---

## Sources

### Primary (HIGH confidence -- all files read in this session)

- `/Users/acolomba/src/pi-claude-marketplace/.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` (the binding contract)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/phases/05-plugin-orchestrators/05-DISCUSSION-LOG.md` (alternatives audit)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/REQUIREMENTS.md` (REQ-IDs)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/ROADMAP.md` lines 110-160 (Phase 5 goal + 6 success criteria + Phase 4 / 5 progress)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/config.json` (workflow flags)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/transaction/phase-ledger.ts` (`runPhases<C>` + `Phase<C>` + `RollbackPartial` + `RunPhasesResult`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/transaction/rollback.ts` (`formatRollbackError`, ROLLBACK_PARTIAL chokepoint -- D-02 extension target)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/transaction/with-state-guard.ts` (ST-7 wrapper; outer-guard / inner-ledger composition pattern)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/types.ts` (`PluginUpdateFn`, `PluginUpdateOutcome`, `PluginUpdatePartition` -- Phase 5 D-09 implementation surface)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/marketplace/shared.ts` (`GitOps`, `DEFAULT_GIT_OPS`, `cascadeUnstagePlugin`, `resolveScopeFromState`, `formatErrorWithCauses`, `applyAutoupdateFlipInPlace`, `AgentsUnstageFailureError`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/marketplace/add.ts` (atomic staging-dir-then-rename + withStateGuard + appendLeaks pattern; reference for install staging-dir leak handling)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/marketplace/remove.ts` (post-state-commit cleanup + per-plugin cascade injection seam + MR-3/MR-6 aggregation -- the closest analog to uninstall.ts)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/marketplace/list.ts` (orchestrator-presentation split; D-04 corollary: no withStateGuard for read-only)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/marketplace/update.ts` (D-14 follow-upstream-blindly sequence; partition rendering MU-7; soft-dep WR-04 fields; cloneAdvanced CR-05; outer-guard-cascade-outside D-08 -- the closest analog to update.ts)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/orchestrators/marketplace/autoupdate.ts` (idempotent flip pattern; SC-6 enumeration)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/domain/resolver.ts` (`ComponentPathsSchema`, `resolveStrict`, `resolveLoose`, `validateComponentPath`, `requireInstallable` -- D-07 migration target)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/domain/manifest.ts` (`MARKETPLACE_VALIDATOR`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/domain/components/plugin.ts` (`PluginEntry`, `PluginManifest` -- `dependencies` is `Type.Optional(Type.Unknown())`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/domain/version.ts` (`computeHashVersion`, `HASH_WALK_SKIP`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/persistence/locations.ts` (`pluginDataDir`/`marketplaceDataDir`/`sourceCloneDir` methods on ScopedLocations; A1 verification)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/persistence/state-io.ts` (`STATE_SCHEMA`, `PLUGIN_INSTALL_RECORD_SCHEMA`, `loadState`/`saveState` -- `resources.{skills,prompts,agents,mcpServers}: string[]`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/bridges/skills/{discover,stage,unstage,types}.ts` (signature surface for D-07 + install ledger phases)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/bridges/commands/{discover,stage,types}.ts` (same)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/bridges/agents/{discover,stage,unstage,marker,index,types}.ts` (foreign-content marker; `findOwnershipConflicts`; `prepareStagePluginAgents` throws on AG-9; `commitPreparedAgents` preserves foreign-preserved entries)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/bridges/mcp/{stage,unstage,parse,index,types}.ts` (`McpServerCollisionError`, MC-4 / MC-6 / MC-7 surfaces; `loadEffectiveServerNames`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/shared/markers.ts` (5 ES-5 prefixes; D-04 extension target)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/shared/errors.ts` (existing error classes; `appendLeakToError`, `appendLeaks`, `errorMessage`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/shared/notify.ts` (sole `ctx.ui.notify` chokepoint; severity-named wrappers)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/shared/fs-utils.ts` (`cleanupStaging`, `pathExists`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/presentation/marketplace-list.ts` (D-06 precedent; icon constant; payload-driven render; `[autoupdate]` suffix shape)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/presentation/reload-hint.ts` (`reloadHint`, `appendReloadHint`, `ReloadVerb`)
- `/Users/acolomba/src/pi-claude-marketplace/extensions/claude-marketplace/presentation/soft-dep.ts` (`subagentWarningIfNeeded`, `mcpAdapterWarningIfNeeded`, ExtensionAPI vs ExtensionContext gotcha)
- `/Users/acolomba/src/pi-claude-marketplace/tests/orchestrators/marketplace/list.test.ts` (test pattern: hermetic HOME, NotifyRecord ctx, ML-3 + NFR-5 source-grep, `stripComments`)
- `/Users/acolomba/src/pi-claude-marketplace/tests/orchestrators/marketplace/update.test.ts` first 100 lines (fixture pattern, makeMockGitOps, seedGithubMarketplace, withHermeticHome, makeGithubSource)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` (D-01..D-14; the architectural family Phase 5 mirrors)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/phases/04-marketplace-orchestrators/04-RESEARCH.md` (Phase 4 research -- the methodology Phase 5 mirrors)

### Secondary (MEDIUM confidence -- referenced by metadata only, not deeply read)

- `docs/prd/pi-claude-marketplace-prd.md` §§5.2.1 / 5.2.2 / 5.2.3 / 5.3.1 / 6.4 / 6.5 / 6.8 / 6.9 / 6.10 / 6.11 / 6.12 -- PRD source of all REQ-IDs and ES-5 marker prefix strings. Read selectively during planning to verify D-04 byte-for-byte and PU-5 notification policy.
- `.planning/phases/03-resource-bridges/03-CONTEXT.md` (D-04 bridge-local staging dirs; D-08 substitution; D-05 RN-4 ownership; carry-forward references in CONTEXT.md)

### Tertiary (LOW confidence -- assumed, flagged in Assumptions Log)

- A2 PU-5 silent-converge notification policy (verify against PRD §5.2.2 literal text during planning).
- A4 PL-4 description source (manifest vs state) -- recommendation: manifest with PL-6 soft-fail fallback.
- A8 `loadMarketplaceManifest` named export -- may need to be introduced as Wave 0 work.
- A9 `import-boundaries.test.ts` already covers `orchestrators/plugin/*` -- verify file content during planning.

---

## Project Constraints (from CLAUDE.md)

These are the load-bearing directives from `/Users/acolomba/src/pi-claude-marketplace/CLAUDE.md` that Phase 5 plans MUST honor verbatim:

- **NFR-4 Node ≥22** -- already enforced by `package.json` engines.
- **NFR-7 strict TS + discriminated installable** -- `ResolvedPluginInstallable` / `ResolvedPluginNotInstallable` already discriminate via `installable: true | false`; D-07 preserves this contract.
- **NFR-11 peer dep** -- `@mariozechner/pi-coding-agent` currently `*`; Phase 5 does NOT touch peer dep (Phase 7's concern).
- **NFR-1 atomic disk writes** -- every bridge already conforms via `atomicWriteJson` (state.json, mcp.json, agents-index.json) and tmp+rename (skills, commands, agents). Phase 5 orchestrators must NOT bypass.
- **NFR-2 no Pi restart** -- `/reload` only.
- **NFR-3 idempotent / fail-clean** -- bridges already idempotent; orchestrators must preserve.
- **NFR-5 network only for github-source `marketplace add/update` and plugin `update`** -- Phase 5 architectural test must enforce: install/uninstall/list MUST NOT import gitOps.
- **NFR-10 containment** -- every name-derived path through `assertPathInside`; `pluginDataDir`/`marketplaceDataDir`/`sourceCloneDir` enforce. Phase 5 only consumes via these methods.
- **NFR-6 `npm run check` green** -- Phase 5 plans MUST end with the check green.
- **IL-2 `ctx.ui.notify` sole channel** -- every user-visible message via `shared/notify.ts` wrappers. ESLint enforces.
- **IL-3 single sanctioned `console.warn`** -- load-time legacy migration save failure only.
- **IL-4 no telemetry V1** -- Phase 5 introduces no event channels or metrics.
- **IL-1 English only V1** -- no message catalog.
- **SC-1 user / project scopes only** -- Phase 5 enumerates these two scopes only.

**Tech stack pinned by CLAUDE.md and Phase 1 D-03:**
- Runtime: Node ≥22 (`>=22.18` recommended for native TS strip)
- TypeScript: `^5.9.3` strict
- typebox: `^1.1.38`
- write-file-atomic: `^8.0.0` (wrapped via `shared/atomic-json.ts`)
- node:test (no Jest, no Vitest)
- ESLint 10 flat config with import-boundary enforcement (`eslint.config.js` per Phase 1 D-11)

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Carried forward from Phase 4; no new libraries |
| Architecture patterns | HIGH | Mirror Phase 4 verbatim -- proven shipped pattern |
| Phase 4 file references | HIGH | Every cited file read in this session |
| 5-phase ledger (D-01) | HIGH | `runPhases` is the verified Phase 2 primitive |
| 3-phase update (D-03) | HIGH | Phase 4 D-02 set the hand-rolled-when-heterogeneous precedent; update.ts mirrors |
| PI-14 bypass (D-02) | HIGH | `formatRollbackError` already exists; only one `instanceof` extension |
| D-04 markers extension | HIGH | `shared/markers.ts` extension surface verified |
| D-05 PI-6 guard | HIGH | Mirrors Phase 4 `orchestrators/marketplace/shared.ts` pattern |
| D-06 list split | HIGH | Mirrors `presentation/marketplace-list.ts` + `orchestrators/marketplace/list.ts` exactly |
| D-07 resolver array migration | HIGH | Resolver code path is well-isolated; test updates predictable |
| D-08 pluginDataDir | HIGH | Method already exists on ScopedLocations |
| D-09 cascade reuse + PluginUpdateFn export | HIGH | Cascade hoisted to shared.ts in Phase 4 explicitly for this |
| Pitfalls catalog | MEDIUM | Pitfalls 1-9 grounded in Phase 4 testing; Pitfalls 10-12 newly identified for Phase 5 |
| Open questions | MEDIUM | All 5 require planner / plan-checker confirmation against PRD verbatim |
| Test taxonomy | HIGH | Mirrors existing test layout (`tests/orchestrators/marketplace/`) |

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days for stable in-repo references; trigger re-research only if Phase 4 ships a hot-fix that changes `cascadeUnstagePlugin` or `formatRollbackError` shape, or if `@mariozechner/pi-coding-agent` peer dep changes major version)
