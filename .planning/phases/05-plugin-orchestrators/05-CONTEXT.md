# Phase 5: Plugin Orchestrators - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can `install`, `uninstall`, and `update` plugins atomically and recoverably. Install stages skills/prompts → agents → MCP → state-commit (5-phase literal-array ledger with phase-ordered rollback). Update is a hand-rolled three-step sequence: prepare-to-tmp → state-guard swap with old-resource snapshot → physical replace + soft-dep commit. Uninstall reverses install order (skills/prompts → agents → MCP → state-commit → per-plugin data-dir cleanup), tolerates concurrent uninstall via silent converge, and refuses loudly on foreign content. Top-level `list` renders icon + name + optional version + status marker + column-66-truncated description, grouped by scope with `[autoupdate]` headers. Phase 5 also lands the COMP-01 supplement-not-replace fix vs V1 (component-path arrays).

Phase 5 owns 51 v1 REQ-IDs (PI-1..15, PU-1..8, PUP-1..9, PL-1..7, RN-3, AS-2, AS-3, AS-6, AS-7, NFR-2, NFR-3) plus COMP-01 from the v2/Compatibility-Fixes bucket. PR-4 is superseded by Phase 5 D-07 (declared + implicit-by-convention paths union, not entry-OR-manifest short-circuit).

Phase 5 produces:

- `orchestrators/plugin/{install,uninstall,update,list,shared}.ts` -- one file per subcommand plus a shared helper module (mirrors Phase 4 layout)
- `presentation/plugin-list.ts` -- pure renderer for top-level `list` (PL-1..7); column-66 truncation helper kept private
- `shared/markers.ts` extension -- new `RECOVERY_PLUGIN_REINSTALL_PREFIX` constant + markers-snapshot.test.ts case (Phase 1 B-4 prefix-equivalence pattern)
- `shared/errors.ts` extensions -- `CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError` (silent-converge sentinel), `PluginUpdatePhase3Error` (wraps the recovery hint)
- `persistence/locations.ts` extension -- new helper `pluginDataDir(loc, marketplace, plugin)` returning `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/`
- `domain/resolver.ts` change -- `ComponentPathsSchema` from optional-string-per-kind to readonly-string-array-per-kind; strict + loose resolvers updated to union declared + implicit-by-convention; PR-4 superseded
- `bridges/{skills,commands,agents}/discover.ts` updates -- iterate over the array of component paths instead of a single string

This phase ends with `npm run check` green, every Phase 5 subcommand callable in isolation (with bridge prepare/commit, `cascadeUnstagePlugin`, `withStateGuard`, and the new PI-6 guard composable from primitives), and a unit-test corpus exercising (a) install happy path + cross-bridge conflict pre-flight + PI-14 PathContainmentError-not-folded-into-rollback-partial + concurrent install detection; (b) uninstall reusing `cascadeUnstagePlugin` + PU-7 foreign-content refusal + PU-5 silent converge + PU-8 reload hint; (c) update bare/`@mp`/`pl@mp` forms + PUP-3..5 partition tagging + PUP-6 phase-3 recovery hint composition + the WR-04 staged-resource threading into RH-5 soft-dep warnings; (d) top-level `list` rendering with all PL-1..7 cases including PL-6 manifest soft-fail; (e) COMP-01 supplement-not-replace via fixture plugins with custom + default convention paths.

</domain>

<decisions>
## Implementation Decisions

### Install Ledger Composition (D-01, D-02)

- **D-01 (5-phase literal Phase<InstallCtx>[]):** `orchestrators/plugin/install.ts` builds a `const phases: readonly Phase<InstallCtx>[] = [skillsPhase, commandsPhase, agentsPhase, mcpPhase, statePhase]` literal array and passes it to `runPhases<InstallCtx>(phases, ctx)`. Each bridge maps to one ledger entry per Phase 3 D-02's documented intent: `do = bridge.commit(prep)`, `undo = bridge.unstage(target)`. Skills and commands stay SEPARATE phases (not collapsed into a combined "resources" phase) -- each bridge's atomic-rename has independent undo semantics, and PRD §5.2.1 PI-9's "skills/prompts" slash reads as adjacency, not co-phase. The terminal state-commit phase has `do = saveState(state)` and `undo = noop` (state guard hasn't fired saveState yet on rollback; ST-7 keeps saveState atomic at file level via `atomicWriteJson`). Composition with `withStateGuard` follows Phase 2 D-02 verbatim: outer guard wraps `runPhases`; the closure mutates state.snapshot through ctx; state-commit phase's `do` is just the final flush trigger before the guard's save.
- **D-01 corollary (InstallCtx shape):** `InstallCtx` is a local type in `orchestrators/plugin/install.ts` (NOT promoted to `orchestrators/types.ts` until a second consumer needs it). Carries `{ scope, locations, marketplace, plugin, manifest, resolved, prepHandles: { skills, commands, agents, mcp }, stateSnapshot }`. Each phase's `do` reads its prep handle from ctx and writes its commit result back into the snapshot's `marketplaces[mp].plugins[plugin].resources.{skills,prompts,agents,mcpServers}` arrays. State-commit phase reads the fully-populated snapshot and is the only phase that touches state-io.
- **D-02 (PI-14 exclusion in `formatRollbackError`, not the orchestrator catch):** `transaction/rollback.ts`'s `formatRollbackError(result, originalError)` is extended to short-circuit when `originalError instanceof PathContainmentError` (covers `SymlinkRefusedError` subclass per Phase 1 D-14..17). On match, return the original error verbatim with cause chain preserved; the `(rollback partial: [phase] msg; …)` summary is SUPPRESSED. Preserves Phase 2 D-03's "single chokepoint for the user-visible marker string" -- every mutating orchestrator (install + update + uninstall) gets PI-14 compliance for free without each catch needing its own `instanceof` guard. New import in `transaction/rollback.ts`: `PathContainmentError` from `shared/errors.ts` (allowed by Phase 1 D-11's import boundaries -- `transaction/` may import from `shared/`).
- **D-02 corollary (PI-14 testing):** `tests/transaction/rollback.test.ts` gains a case where a phase throws `PathContainmentError`; assert (a) `formatRollbackError` returns the original error unwrapped, (b) the rollback-partial marker is NOT present in `err.message`, (c) the cause chain is intact. A second case asserts `SymlinkRefusedError` (subclass) takes the same code path.

### Update Three-Phase Atomic Swap (D-03, D-04)

- **D-03 (Hand-rolled three-step sequence in `update.ts`, NOT `runPhases`):** `orchestrators/plugin/update.ts` executes PUP-6's three phases as an explicit try/catch sequence -- NOT a `runPhases<UpdateCtx>` ledger. Phase 4 D-02 set the precedent: when phases have heterogeneous undo semantics, `runPhases` is the wrong shape. Update's phases are heterogeneous:
  - **Phase 1 (prepare):** Sequentially call each bridge's `prepare*` into bridge-local tmp. On failure: `abort*` each handle that was successfully prepared so far + `cleanupStaging` + rethrow with the cause chained.
  - **Phase 2 (state-guard swap):** Inside `withStateGuard(scope, async (state) => { ... })`: capture `oldSnapshot = state.marketplaces[mp].plugins[plugin].resources` as a local closure variable; validate ST-9 concurrent change (`if (record.installed !== true || record.version !== fromVersion) throw new ConcurrentChangeError(...)`); mutate state in-memory to point at the NEW resource names from prepHandles. Guard's save fires when closure returns; state is now committed pointing at new names but disk still has old.
  - **Phase 3 (physical replace + soft-dep commit):** Sequentially call each bridge's `commit*` on its prepared handle. Aggregate phase-3a (replace) failures into a single `Phase3Failure[]` array (continue across bridge failures -- do NOT fail-fast -- so the partial-replace state is fully observed). After all four bridges' commits complete (success or failure), run phase-3b: compose RH-5 soft-dep warnings via `softDepStatus(ctx)` keyed on which `stagedAgents`/`stagedMcpServers` actually committed. On ANY phase-3a failure: emit `error`-severity notification with the PUP-6 recovery hint (`RECOVERY_PLUGIN_REINSTALL_PREFIX + " \"<name>\"."`) and the aggregated cause chain via `formatErrorWithCauses` (depth 5).
- **D-03 corollary (PUP-7 abort + leak handling):** Phase-3 failure path MUST clean the staging dir (per-bridge prep handles expose a `stagingDir` field; `cleanupStaging` is called on each) AND abort any remaining prepared agents/MCP handles (idempotent -- `abort*` on a committed handle is a noop per Phase 3 D-04 corollary). Leak descriptors from cleanup failures append via `appendLeaks` and bump severity. Original phase-3 error is NEVER masked -- cleanup leaks go on a separate path that surfaces post-throw.
- **D-04 (PUP-6 recovery hint as a markers.ts prefix constant):** New export `RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"` in `shared/markers.ts`. Phase 5 extends `tests/architecture/markers-snapshot.test.ts` with one new case asserting prefix-equivalence against PRD §5.2.3 PUP-6 byte-for-byte (Phase 1 B-4 pattern: runtime caller appends parameter context after the prefix). `orchestrators/plugin/update.ts` composes the final hint as ``${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${pluginName}".``. Treats PUP-6's hint as a stable user contract on par with ES-5 markers -- drift-resistant via the snapshot test. PUP-6's hint is exported from `shared/markers.ts` BUT is NOT a member of the original ES-5 enum (which lists pi-subagents/pi-mcp-adapter/reload-hint/manual-recovery/rollback-partial only) -- it's a Phase 5 extension to the markers surface, documented in the new constant's JSDoc as "PUP-6 recovery hint (Phase 5 extension beyond ES-5)."

### Cross-Bridge Conflict Guard (D-05)

- **D-05 (PI-6 guard in `orchestrators/plugin/shared.ts`):** Mirror Phase 4's `orchestrators/marketplace/shared.ts` pattern. Export `assertNoCrossPluginConflicts(scope: Scope, generatedNames: { skills: readonly string[]; commands: readonly string[]; agents: readonly string[] }, state: StateJson): void`. Pure function -- reads only the passed-in state snapshot. Walks `state.marketplaces[*].plugins[*].resources.{skills,prompts,agents}` from THIS scope only (Phase 2 D-10 cross-scope independence) and detects exact-string collisions per kind. On any conflict: throws `CrossPluginConflictError` with one message listing every conflicting name in deterministic order (skills first, then commands/prompts, then agents; within each kind alphabetical). MCP server names are EXCLUDED per PRD §6.5 -- MC-4 handles same-kind collisions for MCP across the four pi-mcp-adapter slots, not cross-bridge.
- **D-05 callsites:** `install.ts` calls the guard immediately after computing generated names from the resolved plugin (via `domain/name.ts` generators) and BEFORE invoking any bridge's `prepare*`. PI-6 "BEFORE any disk write" is satisfied by construction -- the guard reads state-in-memory only. `update.ts` calls the guard inside phase-1 prepare (after partitioning per PUP-1 and before bridge prepares for the `updated` partition) -- only meaningful for new resource names introduced by the version bump; unchanged names self-pass against the existing record. Note: Phase 3 D-05 corollary documented this Phase 5 ownership; this decision implements it.
- **D-05 corollary (RN-4 cross-marketplace agent ownership stays in bridge):** RN-4 cross-(marketplace, plugin) agent-ownership refusal stays in the agents bridge (`prepareStagePluginAgents` already enforces via `findOwnershipConflicts` per Phase 3 D-05). Phase 5's PI-6 guard handles cross-PLUGIN within-this-marketplace name collisions; the bridge handles cross-MARKETPLACE same-name agent ownership. The two layers are complementary -- both must pass for an install to proceed.

### Top-Level `list` (D-06)

- **D-06 (Orchestrator + presentation split mirroring Phase 4 marketplace-list):** Two files. `orchestrators/plugin/list.ts` reads state per scope, applies `--installed / --available / --unavailable / --scope` filters (PL-1), loads each marketplace's manifest soft-failing on error with `[warning] could not load manifest: <reason>` line (PL-6), computes the `upgradable` flag by string-comparing installed version vs manifest version (PL-5), composes per-marketplace headers with `[autoupdate]` tag (PL-7), and hands the rendering payload to the renderer. `presentation/plugin-list.ts` is the pure formatter -- takes a structured payload (`{ marketplaces: [{ name, scope, autoupdate, plugins: [...] }] }`) and returns a string. Icon table (PL-4: `●` installed installable, `○` not installed installable, `⊘` not installable), version parens, status marker, and column-66 description-truncation are private helpers inside the renderer. Tradeoff: orchestrator is the only side-effecting component; renderer is pure-logic for cheap unit tests.
- **D-06 corollary (truncation helper local):** Column-66 description truncation is a non-exported function inside `presentation/plugin-list.ts`. NOT promoted to `presentation/text-utils.ts`. Phase 4's `presentation/marketplace-list.ts` doesn't need truncation (marketplaces have no description). YAGNI -- promote later only if a third consumer emerges. Test coverage: parametric input covering boundary cases (col 65, 66, 67; multi-byte chars handled byte-wise per PRD §5.3.1 truncation rule).

### COMP-01 Supplement-Not-Replace Fix (D-07)

- **D-07 (Resolver `ComponentPathsSchema` becomes arrays; supersede PR-4):** The V1 / Phase 2 resolver shape `componentPaths: { skills?: string; commands?: string; agents?: string }` becomes `componentPaths: { skills: readonly string[]; commands: readonly string[]; agents: readonly string[] }`. `domain/resolver.ts`'s strict resolver (Step 7 / MM-5) now computes a UNION of declared (entry > manifest) + implicit-by-convention (when the conventional path exists on disk), deduplicated by path string. The loose resolver (MM-6 entry-only) stays single-source -- only entry-declared paths populate the array (no implicit, no manifest). PR-4 ("Detect implicit components by convention ONLY when corresponding manifest field absent") is superseded by D-07 in REQUIREMENTS.md and gets a new row in PROJECT.md's Key Decisions table -- mirrors the D-21 (MA-7) and D-23 (MU-2/MU-3) supersession patterns from earlier phases. CHANGELOG entry: "behavior corrected vs. V1: custom component-path arrays now SUPPLEMENT defaults rather than replace them (COMP-01 / Gap 3)."
- **D-07 corollary (bridge discover signature change):** `bridges/{skills,commands,agents}/discover.ts` each change from reading a single relative string to iterating over the array. Discovery dedups generated names within a single plugin via `Map<generatedName, sourcePath>` -- if two scan paths yield the same source name, the FIRST wins and the second surfaces as a warning via the bridge's `failed[]` channel (consistent with Phase 3 D-06 corollary's foreign-content soft-fail). RN-6 (within-plugin source-name collisions) tightens this: two source names that elide to the same generated name MUST throw with both names listed -- that's already enforced by `domain/name.ts`'s generators and remains a hard error.
- **D-07 supersession effect:** REQUIREMENTS.md PR-4 gets strike-through with "(superseded by Phase 5 D-07: custom paths supplement defaults; implicit-by-convention always detected when dir exists)". PROJECT.md Key Decisions table gets a new row (D-24 in the project-wide decision numbering, distinct from Phase 5 D-07). PRD §6.4 PR-4 retains the original text as historical baseline; the supersession lives in `.planning/` artifacts only.

### Per-Plugin Data Directory (D-08)

- **D-08 (`pluginDataDir` helper in `persistence/locations.ts`; created eagerly post-state-commit on install; cleaned post-state-commit on uninstall):** New helper `pluginDataDir(loc: ScopedLocations, marketplace: string, plugin: string): string` returns `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/` and routes through `assertPathInside`. Install creates the directory (`fs.mkdir({ recursive: true })`) AFTER the state-commit phase succeeds -- failure to create the dir at this point is a `warning`-severity post-commit leak (state already says installed=true) but does NOT roll back the install per AS-6. Uninstall deletes the directory AFTER state-commit per PU-2 (cleanup leaks are `warning`-severity with the leaked path named per PU-4). Update PRESERVES the data dir across versions -- it's user data, not staged code. The `${CLAUDE_PLUGIN_DATA}` substitution in bridge bodies (PI-10) resolves to this path; the dir doesn't need to exist for substitution to be byte-correct (Phase 3 D-08 corollary already documents this).

### Cascade Reuse & PluginUpdateFn Export (D-09)

- **D-09 (`uninstall.ts` reuses `cascadeUnstagePlugin`):** Phase 4 D-02 corollary explicitly reserved `cascadeUnstagePlugin` in `orchestrators/marketplace/shared.ts` for Phase 5 reuse. `orchestrators/plugin/uninstall.ts` imports it directly -- does NOT duplicate the per-plugin 4-bridge unstage loop. PU-1 ordering (skills/prompts → agents → MCP → state commit → data dir) is enforced by `cascadeUnstagePlugin`'s internal ordering (already matches PU-1 per Phase 4 D-03 corollary). Uninstall wraps the cascade in `withStateGuard(scope, ...)`: capture `oldResources` from state, run cascade, on success remove plugin record from state, on concurrent-already-gone (state lacks the record at re-load) silent-converge per PU-5 (return `{ ok: true, alreadyGone: true }`). Post-state-commit data-dir cleanup runs outside the guard per D-08.
- **D-09 corollary (`orchestrators/plugin/update.ts` exports the `PluginUpdateFn` implementation):** Phase 4 D-05 set the function-injection seam; Phase 5 ships the implementation. `orchestrators/plugin/update.ts` exports an `updateSinglePlugin: PluginUpdateFn` that handles ONE plugin's three-phase swap (consumed by Phase 4's autoupdate cascade). The top-level `update` command form (PUP-1 bare/`@mp`/`pl@mp`) is a separate exported `updatePlugins(opts)` that enumerates targets per PUP-1, calls `syncClone` once per marketplace via `gitOps.fetch + checkout` (PUP-2), and loops over plugins calling `updateSinglePlugin` for each -- collecting `PluginUpdateOutcome[]` and rendering the MU-7 partition output. The two entry points share the per-plugin three-phase implementation (D-03). PUP-9 ("direct (non-cascade) update throws → error-severity notification") routes: when `updatePlugins` is invoked directly (not via Phase 4 cascade), a phase-2 or earlier-phase throw surfaces as `error` severity; when it's the cascade path, the throw is captured in `PluginUpdateOutcome.partition = 'failed'` instead.

### Claude's Discretion

The user signed off on every recommended option presented:

- **D-01 (5-phase ledger):** Recommended; user chose. Escalation: if a future need to combine skills+commands at the ledger level emerges (e.g., a shared atomic-rename helper), the array can collapse to 4 without changing bridge surfaces -- just the call-site array literal changes.
- **D-02 (formatRollbackError owns PI-14 bypass):** Recommended; user chose. Escalation: if a third error class needs the same "no rollback-partial wrapping" treatment (e.g., a future `NetworkPolicyViolationError`), extend the `instanceof` check in `formatRollbackError` rather than each orchestrator's catch.
- **D-03 (hand-rolled update sequence):** Recommended; user chose. Escalation: if a real failure mode shows that the phase-3a aggregation needs distinct rollback semantics per bridge, the inner loop can wrap each bridge.commit in a try/catch without changing the overall three-phase contract.
- **D-04 (recovery hint as markers.ts prefix):** Recommended; user chose. Escalation: if other Phase 5 strings emerge as stable user contracts (e.g., the PI-15 "was installed concurrently" message), they likewise gain prefix constants in `shared/markers.ts` with markers-snapshot.test.ts cases.
- **D-05 (PI-6 guard in `orchestrators/plugin/shared.ts`):** Recommended; user chose. Escalation: if `cascadeUnstagePlugin` from `orchestrators/marketplace/shared.ts` and `assertNoCrossPluginConflicts` from `orchestrators/plugin/shared.ts` need any third shared helper across marketplace + plugin domains, promote it to `orchestrators/types.ts` (per Phase 4 D-06's elevation rule).
- **D-06 (orchestrator+presentation split, truncation private):** Recommended; user chose. Escalation: promotion to `presentation/text-utils.ts` is one-commit refactor when a third consumer arrives.
- **D-07 (resolver arrays + PR-4 supersession):** Recommended; user chose. Escalation: the new `ComponentPathsSchema` array shape is forward-compatible -- adding implicit-by-convention rules for new component types (e.g., agents/skills subdirectory conventions per upstream Claude Code) is additive.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec (PRD)

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §5.2.1 -- PI-1..15 install rules; PI-6 cross-bridge conflict guard, PI-9 staging order, PI-14 PathContainmentError exclusion, PI-15 concurrent install
- `docs/prd/pi-claude-marketplace-prd.md` §5.2.2 -- PU-1..8 uninstall (PU-1 order, PU-2 data dir AFTER state commit, PU-5 silent converge, PU-7 foreign content, PU-8 reload hint)
- `docs/prd/pi-claude-marketplace-prd.md` §5.2.3 -- PUP-1..9 update (PUP-6 three-phase + recovery hint literal text, PUP-7 phase-3 abort, PUP-9 cascade vs direct)
- `docs/prd/pi-claude-marketplace-prd.md` §5.3.1 -- PL-1..7 top-level list (PL-4 icon table, PL-5 upgradable comparator, PL-6 manifest soft-fail, PL-7 [autoupdate] tag)
- `docs/prd/pi-claude-marketplace-prd.md` §6.4 -- PR-1..6 resolver; PR-4 is SUPERSEDED by Phase 5 D-07 (supplement-not-replace)
- `docs/prd/pi-claude-marketplace-prd.md` §6.5 -- RN-1..6 resource naming + `assertSafeName`; RN-3 cross-plugin conflict guard timing ("BEFORE any disk write"); RN-4 cross-marketplace agent ownership (bridge-enforced)
- `docs/prd/pi-claude-marketplace-prd.md` §6.8 -- RH-1..5 reload hint format + soft-dep probing; PU-8 install/uninstall reload hint and PUP-8 update reload hint
- `docs/prd/pi-claude-marketplace-prd.md` §6.9 -- ST-1..9 state persistence; ST-7 `withStateGuard` mandate; ST-8 concurrent install/uninstall; ST-9 concurrent update
- `docs/prd/pi-claude-marketplace-prd.md` §6.10 -- PS-1..5 path safety; PS-4 containment violations during rollback propagate (matches PI-14 + D-02 enforcement)
- `docs/prd/pi-claude-marketplace-prd.md` §6.11 -- AS-1..9 atomic staging; AS-2 install order, AS-3 update three-phase, AS-4 rollback-partial format, AS-6 post-commit leak warning severity, AS-7 orphan agent index entries
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 -- ES-1..5 error surfaces; ES-5 stable user-contract markers
- `docs/prd/pi-claude-marketplace-prd.md` §10 -- NFR-2 no Pi restart, NFR-3 idempotent/fail-clean
- `docs/prd/pi-claude-marketplace-prd.md` §11 -- V1 deferrals (COMP-01 was here; Phase 5 D-07 brings it in-scope as a behavior-corrected-vs-V1 ship)

### Project planning

- `.planning/PROJECT.md` -- Key Decisions table will gain a new row noting PR-4 supersession by Phase 5 D-07 at phase transition
- `.planning/REQUIREMENTS.md` -- Phase 5 owns the 51 listed under § "Per-phase counts" plus COMP-01; PR-4 will be marked "(superseded by Phase 5 D-07)" at phase transition
- `.planning/ROADMAP.md` lines 122-130 -- Phase 5 goal + 6 success criteria
- `.planning/STATE.md` -- Current state; Phase 4 complete (521 tests, all decisions D-01..D-14 shipped)

### Phase 1 carry-forward (consumed by Phase 5)

- `.planning/phases/01-foundations-toolchain/01-CONTEXT.md` -- D-03 (`write-file-atomic@^8`), D-06/D-07 (notify wrappers + ESLint output discipline), D-08 (markers.ts as the single chokepoint for ES-5 strings; Phase 5 extends with `RECOVERY_PLUGIN_REINSTALL_PREFIX`), B-4 (prefix-equivalence pattern for the new marker), D-11 (import boundaries: `orchestrators/` may import from `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`), D-14..17 (`assertPathInside` with symlink refusal → `PathContainmentError` is the type detected by D-02)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `notifySuccess`, `notifyWarning`, `notifyError(ctx, msg, cause?)`. Every Phase 5 user-visible message routes through these.
- `extensions/pi-claude-marketplace/shared/markers.ts` -- ES-5 strings + `RELOAD_HINT_PREFIX`. Phase 5 ADDS `RECOVERY_PLUGIN_REINSTALL_PREFIX` here.
- `extensions/pi-claude-marketplace/shared/path-safety.ts` -- `assertPathInside` + `SymlinkRefusedError`; called on every name-derived path (data dir, staging dir, bridge target paths).
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` -- `atomicWriteJson` consumed indirectly via state-io and agents-index-io.
- `extensions/pi-claude-marketplace/shared/errors.ts` -- `PathContainmentError`, `appendLeakToError`, `appendLeaks`, `errorMessage`. Phase 5 ADDS `CrossPluginConflictError`, `ConcurrentInstallError`, `ConcurrentUninstallError`, `PluginUpdatePhase3Error`.
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` -- `cleanupStaging`, `pathExists`. Phase 5 install + update prepare-rollback paths consume both.

### Phase 2 carry-forward (consumed by Phase 5)

- `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md` -- D-01 (`runPhases<C>` literal-array ledger discipline; install.ts is the FIRST production consumer), D-02 (`withStateGuard` × `runPhases` composition pattern -- install.ts and uninstall.ts follow verbatim), D-03 (`formatRollbackError` is THE single chokepoint for the `(rollback partial: …)` marker -- Phase 5 D-02 extends it with the PI-14 bypass), D-04 (`resolveStrict`/`resolveLoose`), D-05 (`assertSafeName` + name generators), D-06 (`parsePluginSource` factories), D-07 (TypeBox JIT at module load), D-09 (state shape `{marketplaces: {<mp>: {plugins: {<plugin>: {…}}}}}`), D-10 (cross-scope independence), D-11 (CRLF/BOM normalization for hash version)
- `extensions/pi-claude-marketplace/domain/resolver.ts` -- `resolveStrict`, `resolveLoose`, `requireInstallable`; Phase 5 D-07 CHANGES `ComponentPathsSchema` to readonly-string-array; supersedes PR-4
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- `MARKETPLACE_VALIDATOR`, `PLUGIN_MANIFEST_VALIDATOR`; install reads cached manifest only (PI-2)
- `extensions/pi-claude-marketplace/domain/name.ts` -- `assertSafeName` + skill/command/agent generators; consumed by D-05 PI-6 guard for input computation
- `extensions/pi-claude-marketplace/domain/version.ts` -- `computeHashVersion` + `HASH_WALK_SKIP`; install's PI-7 version resolution and update's PUP-3 unchanged-detection both use this
- `extensions/pi-claude-marketplace/persistence/locations.ts` -- `ScopedLocations` brand + `locationsFor(scope, cwd)`; Phase 5 ADDS `pluginDataDir(loc, marketplace, plugin)` helper (D-08)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` -- `loadState`, `saveState`, `STATE_VALIDATOR`; install/uninstall/update mutate state via `withStateGuard` closures
- `extensions/pi-claude-marketplace/persistence/migrate.ts` -- `migrateLegacyMarketplaceRecords`; ST-4/ST-5 + PU-6 legacy-state-load handling
- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` -- `runPhases<C>`, `Phase<C>`; install.ts consumes
- `extensions/pi-claude-marketplace/transaction/rollback.ts` -- `formatRollbackError`; Phase 5 D-02 EXTENDS with PI-14 bypass logic
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` -- `withStateGuard`; every Phase 5 mutating orchestrator wraps in this

### Phase 3 carry-forward (consumed by Phase 5)

- `.planning/phases/03-resource-bridges/03-CONTEXT.md` -- D-01 (per-bridge concrete signatures with opaque `Prepared<bridge>` handles), D-02 (bridge-as-Phase composition documented for Phase 5; D-01 install ledger implements verbatim), D-04 (compute-target-then-atomic-apply per bridge), D-05 corollary (cross-bridge PI-6 guard is Phase 5's job -- D-05 implements), D-06 (marker discipline: agents bridge fails loudly on foreign content; PU-7 propagates), D-08 (PI-10 `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution; D-08 of THIS context confirms data dir resolution)
- `extensions/pi-claude-marketplace/bridges/skills/index.ts` -- `prepareStageSkills`, `commitPreparedSkills`, `abortPreparedSkills`, `unstagePluginSkills`, `assertNoSkillCollisions`, `discoverPluginSkills`. Phase 5 D-07 CHANGES `discoverPluginSkills` to iterate array of component paths.
- `extensions/pi-claude-marketplace/bridges/commands/index.ts` -- same family. Phase 5 D-07 CHANGES `discoverPluginCommands` to iterate array.
- `extensions/pi-claude-marketplace/bridges/agents/index.ts` -- `prepareStagePluginAgents`, `commitPreparedAgents`, `abortPreparedAgents`, `unstagePluginAgents`, `findOwnershipConflicts`, `discoverPluginAgents`. RN-4 cross-marketplace ownership stays bridge-enforced (D-05 corollary). Phase 5 D-07 CHANGES `discoverPluginAgents` to iterate array.
- `extensions/pi-claude-marketplace/bridges/mcp/index.ts` -- `prepareStageMcpServers`, `commitPreparedMcp`, `abortPreparedMcp`, `unstageMcpServers`, `MCP_COLLISION_SLOTS`. MC-4 same-kind collision stays bridge-enforced (excluded from PI-6 per D-05).
- `extensions/pi-claude-marketplace/persistence/agents-index-io.ts` -- agents-index round-trip; uninstall's PU-7 foreign-content refusal surfaces through the index

### Phase 4 carry-forward (consumed by Phase 5)

- `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` -- D-01 (subcommand 1:1 file mapping -- Phase 5 mirrors with `orchestrators/plugin/{install,uninstall,update,list,shared}.ts`), D-02 corollary (`cascadeUnstagePlugin` reserved for Phase 5 reuse -- D-09 implements), D-03 (PU-1 order matches cascade order), D-05/D-06 (`PluginUpdateFn` + `PluginUpdateOutcome` in `orchestrators/types.ts` -- Phase 5 D-09 corollary ships the real implementation), D-14 (follow-upstream-blindly for `marketplace update`'s clone refresh -- Phase 5's `syncClone` via PUP-2 reuses Phase 4's `gitOps.fetch + forceUpdateRef + checkout` chain)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- `cascadeUnstagePlugin(plugin, marketplace, locations)`, `GitOps` interface, `DEFAULT_GIT_OPS`, `resolveScopeFromState`, `formatErrorWithCauses`. Phase 5's `uninstall.ts` imports `cascadeUnstagePlugin` directly; `update.ts` imports `GitOps` + `DEFAULT_GIT_OPS` for the PUP-2 syncClone.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- `PluginUpdateFn`, `PluginUpdateOutcome`, `PluginUpdatePartition`. Phase 5 D-09 corollary exports the real `updateSinglePlugin: PluginUpdateFn` from `orchestrators/plugin/update.ts`.
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` -- `composeReloadHint(changedNames, verb)`. Install/uninstall/update emit PU-8/PUP-8 hints via this.
- `extensions/pi-claude-marketplace/presentation/soft-dep.ts` -- `softDepStatus(ctx)` returning `{ subagentsLoaded, mcpAdapterLoaded }`; PI-11/PI-12 (install) and RH-5 (update phase-3b) consume.
- `extensions/pi-claude-marketplace/presentation/marketplace-list.ts` -- PRESENTATION LAYER pattern that Phase 5 D-06 mirrors with `presentation/plugin-list.ts`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` -- ORCHESTRATOR LAYER pattern that Phase 5 D-06 mirrors with `orchestrators/plugin/list.ts`.

### Research foundation (already produced)

- `.planning/research/ARCHITECTURE.md` -- 9-folder layout (orchestrators sit above bridges); literal-array ledger discipline (Phase 5 install.ts is the canonical consumer); update three-phase is hand-rolled per D-03 (Phase 4 D-02 precedent)
- `.planning/research/PITFALLS.md` -- Pitfall 1 (atomicity vs durability -- D-08 same-FS data dir on scope root mitigates), Pitfall 9 (foreign content -- PU-7 propagates), Pitfall 10 (marker drift -- D-04 markers-snapshot test guards), Pitfall 15 (notify discipline -- every Phase 5 message via `shared/notify.ts`)
- `.planning/research/STACK.md` -- TypeBox 1.x JIT for state schema; `write-file-atomic` for state.json saves
- `.planning/research/SUMMARY.md` -- Phase 5 sits between Phase 4 (marketplace orchestrators) and Phase 6 (edge layer)

### Library docs (planner should pull current versions)

- `node:fs/promises` -- `rename`, `mkdir({recursive:true})`, `rm({recursive:true, force:true})`, `stat`, `readdir({withFileTypes:true})` for prepare/commit/abort paths and data-dir lifecycle
- `node:crypto` -- `randomUUID()` for staging-dir UUIDs (Phase 3 precedent reused)
- `node:path` -- `resolve`, `join`, `relative` for path containment and PI-10 substitution targets
- `typebox` 1.1.38+ -- consumed indirectly via persistence/state-io and agents-index-io; resolver's ComponentPathsSchema change (D-07) keeps TypeBox JIT shape compatible (readonly array of strings)
- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- `ExtensionContext.pi.getAllTools()` signature for soft-dep probing (RH-3, RH-4, PI-11, PI-12)

### V1 reference (read selectively when implementing the same concern)

- `git show features/initial:extensions/pi-claude-marketplace/plugin/install.ts` -- V1 install orchestrator; 4-phase ordering pattern. NOTE: V1 has the COMP-01 BUG (component-path replacement rather than supplement) -- Phase 5 D-07 corrects.
- `git show features/initial:extensions/pi-claude-marketplace/plugin/uninstall.ts` -- V1 uninstall; PU-1 ordering reference
- `git show features/initial:extensions/pi-claude-marketplace/plugin/update.ts` -- V1 update three-phase; PUP-6 recovery hint phrasing reference
- `git show features/initial:extensions/pi-claude-marketplace/plugin/list.ts` -- V1 list; PL-4 icon table + column-66 truncation reference
- `git show features/initial:extensions/pi-claude-marketplace/resolver/*` -- V1 resolver; PR-4 short-circuit behavior (the bug Phase 5 D-07 corrects)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 1, 2, 3, 4 outputs)

- **`extensions/pi-claude-marketplace/shared/markers.ts`** -- Phase 5 ADDS `RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for"` here. Existing 5 ES-5 prefix constants stay unchanged; the snapshot test (`tests/architecture/markers-snapshot.test.ts`) gains one new prefix-equivalence case asserting against PRD §5.2.3 PUP-6.
- **`extensions/pi-claude-marketplace/shared/errors.ts`** -- Phase 5 ADDS four new error classes:
  - `CrossPluginConflictError extends Error` (PI-6 cross-bridge name guard; message lists every conflicting name in deterministic order)
  - `ConcurrentInstallError extends Error` (PI-15; surfaces the "was installed concurrently" string at the state-guard save boundary; rollback runs)
  - `ConcurrentUninstallError extends Error` (PU-5; sentinel for the silent-converge path -- uninstall.ts catches this and returns `{ ok: true, alreadyGone: true }` per PRD §5.2.2)
  - `PluginUpdatePhase3Error extends Error` (PUP-6 wrapper that carries the aggregated phase-3a `Phase3Failure[]` plus the original error chain via `Error.cause`; surfaces with the `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint composed in update.ts's catch)
- **`extensions/pi-claude-marketplace/transaction/rollback.ts`** -- Phase 5 D-02 EXTENDS `formatRollbackError(result, originalError)` with an `instanceof PathContainmentError` short-circuit (covers `SymlinkRefusedError`). On match: return originalError verbatim, suppress the `(rollback partial: …)` summary. Import: `import { PathContainmentError } from "../shared/errors.ts"`.
- **`extensions/pi-claude-marketplace/transaction/phase-ledger.ts`** -- `runPhases<C>` + `Phase<C>`. Install.ts is the first production consumer. The literal-array discipline (Phase 2 D-01) is binding -- `const phases: readonly Phase<InstallCtx>[] = [...]` at the install.ts callsite.
- **`extensions/pi-claude-marketplace/transaction/with-state-guard.ts`** -- Install, uninstall, update each wrap their flow in one. Update's swap phase is the closure body (PUP-6 phase-2); install's closure body is the entire `runPhases` call (Phase 2 D-02 verbatim composition); uninstall's closure body is the cascade + state-record-removal.
- **`extensions/pi-claude-marketplace/persistence/locations.ts`** -- Phase 5 ADDS `pluginDataDir(loc: ScopedLocations, marketplace: string, plugin: string): string` returning `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/`. Goes through `assertPathInside` against the scope root. Used by install (eager mkdir post-state-commit) and uninstall (rm-rf post-state-commit per PU-2/PU-4) and by the PI-10 `${CLAUDE_PLUGIN_DATA}` substitution input (bridges already accept the resolved path from the orchestrator).
- **`extensions/pi-claude-marketplace/domain/resolver.ts`** -- Phase 5 D-07 CHANGES `ComponentPathsSchema` to readonly-string-array-per-kind; strict and loose resolver Step 7 logic changes accordingly. Supersedes PR-4.
- **`extensions/pi-claude-marketplace/domain/name.ts`** -- `assertSafeName` + the three generators; D-05's PI-6 guard input computation reuses these.
- **`extensions/pi-claude-marketplace/domain/version.ts`** -- `computeHashVersion` + `HASH_WALK_SKIP`. Install's PI-7 fallback uses this; update's PUP-3 uses string equality on either `manifest.version` or `hash-<12hex>` (precedent: Phase 2 hash-stability snapshot test).
- **`extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp}/index.ts`** -- `prepare*`, `commit*`, `abort*`, `unstage*` primitives. Install ledger phases call these directly; update three-phase calls them across the three explicit steps; uninstall reuses `cascadeUnstagePlugin` from Phase 4 (which itself calls these).
- **`extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`** -- `cascadeUnstagePlugin`, `GitOps`, `DEFAULT_GIT_OPS`, `resolveScopeFromState`, `formatErrorWithCauses`. Phase 5 uninstall imports `cascadeUnstagePlugin` directly; update imports `GitOps` + `DEFAULT_GIT_OPS` for PUP-2 syncClone.
- **`extensions/pi-claude-marketplace/orchestrators/types.ts`** -- `PluginUpdateFn`, `PluginUpdateOutcome`, `PluginUpdatePartition`. Phase 5 ships the implementation matching `PluginUpdateFn`; threading `stagedAgents`/`stagedMcpServers` (WR-04 fields already in place) into RH-5 soft-dep warning composition.
- **`extensions/pi-claude-marketplace/presentation/{reload-hint,soft-dep,marketplace-list}.ts`** -- Phase 5 install/uninstall/update consume `composeReloadHint` + `softDepStatus`. `marketplace-list.ts` is the orchestrator+presentation split PRECEDENT that Phase 5 D-06 mirrors.

### Established Patterns (carry forward unchanged)

- **TypeScript strict + ESM** -- All Phase 5 modules follow.
- **Import boundaries** -- `orchestrators/` may import from `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. Imports from `edge/` are forbidden. `orchestrators/plugin/` may import from `orchestrators/marketplace/` ONLY for the `cascadeUnstagePlugin` + `GitOps` reuse, OR via `orchestrators/types.ts` for `PluginUpdateFn`/`PluginUpdateOutcome`. NO cycle: `orchestrators/marketplace/` does NOT import from `orchestrators/plugin/` -- Phase 4's `marketplace update` cascade uses the injected `PluginUpdateFn` only.
- **TypeBox JIT compile at module load** -- Phase 5 doesn't define new schemas; consumes validators from `domain/manifest.ts`, `persistence/state-io.ts`, `persistence/agents-index-schema.ts`. The `ComponentPathsSchema` change (D-07) keeps TypeBox shape compatible (readonly array of strings).
- **`npm run check` pipeline** -- typecheck + ESLint + Prettier + `node --test "tests/**/*.test.ts"` MUST stay green per NFR-6.
- **PRD-as-snapshot-fixture (Phase 1 D-09)** -- `tests/helpers/prd-extract.ts`. Phase 5 uses for PUP-6 recovery hint prefix-equivalence (D-04) and PU-8 / PUP-8 reload hint verb table.
- **Pre-commit hook chain** -- unicode-dash + smartquote + mdformat + markdownlint-cli2 (.claude/ excluded; .planning/ excluded from large-file check). Avoid em-dashes in commit titles (Phase 3 lessons).

### Integration Points

- **Phase 6 edge layer (via dispatch surface):** Phase 6's `edge/router.ts` calls each Phase 5 orchestrator with parsed args + the injected `gitOps` / `ctx`. Phase 5's orchestrators are pure functions of `(ctx, args, deps)`; they do not register pi commands themselves.
- **Phase 7 `index.ts` (injection wiring):** The extension entrypoint wires `platform/git.ts` exports into the default `GitOps`, Phase 5's `updateSinglePlugin` into Phase 4's `marketplace update` cascade hook, and registers the `/claude:plugin` subcommand surface.
- **Phase 4 `marketplace update` cascade:** Phase 4's `update.ts` invokes the injected `PluginUpdateFn` once per installed plugin during the autoupdate cascade; Phase 5 D-09 corollary ships `updateSinglePlugin` matching that signature. The WR-04 `stagedAgents`/`stagedMcpServers` fields on `PluginUpdateOutcome` thread back to Phase 4's RH-5 soft-dep warning composition.
- **State recording:** Install writes `state.marketplaces[mp].plugins[pl] = { version, resolvedSource, compatibility, resources: {...}, installedAt, updatedAt }`. Uninstall deletes the entry. Update mutates `resources.{skills,prompts,agents,mcpServers}` + `version` + `updatedAt`. Concurrent detection (PI-15, ST-9) surfaces at the guard's save boundary.
- **`pi.getAllTools()` soft-dep probing:** Install's PI-11/PI-12 and update's RH-5 phase-3b consume `softDepStatus(ctx)` from Phase 4's `presentation/soft-dep.ts`. Each orchestrator decides which warnings to compose based on whether the relevant resource kind was actually staged.
- **`resources_discover`:** Phase 3 shipped per-scope discovery helpers; Phase 7 wires the event handler. Phase 5 does NOT touch this surface -- install/uninstall/update affect what `resources_discover` finds on next `/reload`, but the event handler stays Phase 7's responsibility.

</code_context>

<specifics>
## Specific Ideas

- **`install` test taxonomy** -- `tests/orchestrators/plugin/install.test.ts` covers PI-1 (token parse), PI-2 (no network -- assert `gitOps` is never invoked), PI-3 (plugin not in manifest), PI-4 (non-installable), PI-5 (already installed), PI-6 (cross-bridge conflict pre-flight; multi-name message), PI-7 (version resolution: manifest > entry > hash), PI-8 (staging on same FS; cleanupWarnings surface), PI-9 (5-phase ledger order via Phase ordering test + rollback when phase 4 throws), PI-10 (substitution byte-for-byte via fixture), PI-11/PI-12 (canonical soft-dep warning strings present in success message when relevant kind staged), PI-13 (dependencies declaration → manual-install warning), PI-14 (`PathContainmentError` thrown in any phase does NOT fold into rollback-partial), PI-15 (concurrent install at state-guard save).
- **`uninstall` test taxonomy** -- `tests/orchestrators/plugin/uninstall.test.ts` covers PU-1 (order via spy on bridge unstages), PU-2 (state commit BEFORE data-dir cleanup), PU-3 (failure earlier than data-dir aborts with marketplace record intact), PU-4 (data-dir cleanup leak surfaces as warning with leaked path), PU-5 (silent converge via `ConcurrentUninstallError` sentinel), PU-6 (legacy state without `resources.agents`/`resources.mcpServers` migrates to `[]`), PU-7 (foreign-content at agent target → fails loudly), PU-8 (`Run /reload to drop "..."` only when ≥1 resource removed).
- **`update` test taxonomy** -- `tests/orchestrators/plugin/update.test.ts` covers PUP-1 (three forms; empty-target silent success), PUP-2 (`syncClone` once per marketplace via mocked `GitOps`), PUP-3 (unchanged via version equality -- no I/O), PUP-4 (skipped: no longer installable), PUP-5 (skipped: missing from manifest), PUP-6 (three-phase happy + phase-3 failure → `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint surfaces with quoted name), PUP-7 (phase-3 abort cleans staging without masking original error), PUP-8 (reload hint when ≥1 plugin updated), PUP-9 (direct vs cascade error severity: direct = `error`, cascade = `PluginUpdateOutcome.partition = 'failed'`).
- **`list` test taxonomy** -- `tests/orchestrators/plugin/list.test.ts` covers PL-1 (no flags shows every bucket; flag union semantics), PL-2 (nested tree grouped by scope), PL-3 (marketplace-name narrowing), PL-4 (icon table per fixture; status markers), PL-5 (upgradable comparator: installed `1.0.0` vs manifest `1.0.1` → flagged), PL-6 (manifest load failure shows `[warning] could not load manifest: <reason>` AND still renders installed plugins), PL-7 (`[autoupdate]` per-marketplace header tag).
- **`presentation/plugin-list.test.ts`** -- Pure-formatter unit tests on the rendering payload structure. Column-66 truncation: parametric inputs at columns 65/66/67/100; PL-4 icon round-trip; PL-5 upgradable marker rendering; PL-6 warning-line composition.
- **`assertNoCrossPluginConflicts` test** -- `tests/orchestrators/plugin/shared.test.ts` covers (a) no conflicts → returns void; (b) skill name collides → throws with one name listed; (c) skill + command + agent each collide → one error with three names in deterministic order; (d) MCP collision NOT detected (PRD §6.5 exclusion); (e) other-scope plugin with same name does NOT conflict (Phase 2 D-10).
- **`formatRollbackError` PI-14 bypass test** -- `tests/transaction/rollback.test.ts` gains two cases: (a) `PathContainmentError` originalError → return original verbatim, no `(rollback partial: ...)` marker, cause chain intact; (b) `SymlinkRefusedError` (subclass) → same behavior.
- **Markers snapshot -- `RECOVERY_PLUGIN_REINSTALL_PREFIX`** -- `tests/architecture/markers-snapshot.test.ts` adds one case asserting the prefix is byte-for-byte equal to PRD §5.2.3 PUP-6 literal `plugin-uninstall + plugin-install for`. Snapshot fails loudly if PRD text drifts or markers.ts export name changes.
- **COMP-01 fixture -- `tests/domain/resolver-comp01.test.ts`** -- Three fixture plugins: (a) only-default-skills (no manifest field; default `skills/` dir exists) → `componentPaths.skills === ['skills']`; (b) only-custom-skills (manifest declares `["custom/skills"]`; default `skills/` does NOT exist) → `componentPaths.skills === ['custom/skills']`; (c) both (manifest declares `["custom/skills"]`; default `skills/` ALSO exists) → `componentPaths.skills === ['custom/skills', 'skills']` (UNION; the COMP-01 fix). Loose-mode counterpart in `resolver-loose.test.ts` verifies entry-only semantics still hold under MM-6.
- **`pluginDataDir` containment test** -- `tests/persistence/locations.test.ts` adds parametric cases verifying `pluginDataDir` routes through `assertPathInside` for marketplace/plugin names containing path-separator attempts (`..`, `/`, `\`). RN-2 `assertSafeName` is the input gate; `pluginDataDir` is the output gate.
- **Phase 5 D-07 supersession PR** -- Like Phase 4 D-14's MU-2/MU-3 supersession, Phase 5 plan includes one task that updates REQUIREMENTS.md PR-4 with strikethrough + adds a PROJECT.md Key Decisions row + adds CHANGELOG entry. Pattern follows Phase 1 D-21 (MA-7) and Phase 4 D-23 (MU-2/MU-3).

</specifics>

<deferred>
## Deferred Ideas

- **`info` subcommand** -- PRD §11 / INFO-01 (v2 Requirements). Strongest post-V1 candidate per FEATURES.md but explicitly out of scope for Phase 5.
- **`--force` install with `incomplete` state** -- PRD §11 deferral. Phase 5 enforces the "block on partial support" model verbatim; a future `--force` flag is post-V1.
- **JSON output / dry-run modes** -- PRD §11 deferral. Phase 5's orchestrator return shapes (`{ outcome, recorded, rollbackPartials, cleanupWarnings }`) are JSON-serializable, so a future `--json` flag in Phase 6 edge layer renders them without changing Phase 5 internals.
- **Manifest-mtime caching (NFR-8 / PERF-01)** -- Backlog. Phase 5's `list` re-reads manifests per render (PL-5/PL-6); a wrapper layer above `loadMarketplaceManifest` is the seam where caching lands.
- **Session-start autoupdate run** -- PRD §11 (Claude Code parity). Phase 5 implements `update` and the autoupdate cascade hook (`updateSinglePlugin`); session-start invocation is post-V1.
- **Rich interactive selectors for cross-scope ambiguity** -- PRD §11. SC-4 dual-found cases throw with clear "specify --scope user or --scope project" hints; rich interaction (e.g., "Which scope?") is post-V1.
- **Parallel update cascade** -- Phase 5 implements sequential per-plugin updates inside `marketplace update`'s cascade (preserves notification ordering); parallel updates are a perf optimization deferred until measured.
- **Telemetry / event channels for install/update outcomes** -- IL-4 forbids telemetry V1. The structured `PluginUpdateOutcome[]` and `rollbackPartials[]` shapes are suitable for a future IL-5 event channel without rework.
- **Hardlink-based skill copy** -- PRD §11 / Phase 3 deferred. If skill directories grow large, hardlinks could replace recursive copy. Cross-FS limitations make this fragile; not Phase 5.
- **`pi-subagents` / `pi-mcp-adapter` registration UI** -- Soft-dep loading is the user's concern. Phase 5 emits the canonical warning strings (PI-11/PI-12/RH-5) but does NOT manage the companion extension's lifecycle.
- **PR-4 retention in PRD §6.4** -- Phase 5 D-07 supersedes PR-4 in `.planning/` artifacts. A future PRD v2 revision can rewrite §6.4 to match D-07 directly; for V1 the supersession lives in REQUIREMENTS.md and PROJECT.md per the D-21/D-23 pattern.
- **Cross-scope shadowing warning** -- Phase 2 D-10 already rejected this; if real-world usage shows users are surprised, a future `--strict-isolation` flag would carry it. Not Phase 5.
- **`update --force` to re-stage despite same version** -- PUP-3 currently `unchanged`-tags equal-version plugins with no I/O. A future `--force` flag to re-stage regardless is post-V1.

</deferred>

---

*Phase: 5-Plugin Orchestrators*
*Context gathered: 2026-05-10*
