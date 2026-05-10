# Phase 4: Marketplace Orchestrators - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can manage marketplace records (`marketplace add / remove / rm / list / update / autoupdate / noautoupdate`) atomically with: clone-then-rename staging for GitHub sources, cascade-drop on remove that aggregates per-plugin failures into one `warning`-severity notification, manifest pointer refresh on update with optional plugin-upgrade cascade (gated on the per-marketplace `autoupdate` flag), and reload-hint emission only when generated resources actually change.

Phase 4 owns 38 v1 REQ-IDs (MA-1..6, MA-8..11; MR-1..8; ML-1..4; MU-1..9; MAU-1..4; SC-5, SC-6; RH-1..5; NFR-5 boundary). MA-7 is removed per Phase 1 D-21 (isomorphic-git supersedes the "git not found on PATH" failure mode). MU-2/MU-3 are superseded by D-14 below (the local marketplace clone is read-only by contract; "follow upstream blindly" replaces fast-forward-or-fail semantics).

Phase 4 produces:

- `orchestrators/marketplace/{add,remove,list,update,autoupdate,shared}.ts` -- one file per subcommand plus a shared helper module
- `orchestrators/types.ts` -- cross-orchestrator types (`PluginUpdateFn`, `PluginUpdateOutcome`) used by the Phase 4 → Phase 5 cascade hand-off
- `presentation/reload-hint.ts` -- compose `Run /reload to <verb> "n1", "n2", ...".` from MARKERS + verb selection (RH-1, RH-2)
- `presentation/soft-dep.ts` -- `pi-subagents` / `pi-mcp-adapter` warning composition via `pi.getAllTools()` probe (RH-3, RH-4, RH-5)
- `persistence/locations.ts` extension -- new helper `sourcesStagingDir(loc, uuid)` returning a path under `<scopeRoot>/claude-marketplace/sources-staging/<uuid>/`

This phase ends with `npm run check` green, every Phase 4 subcommand callable in isolation (with `gitOps` and `PluginUpdateFn` injection points testable via mocks), and a unit-test corpus that exercises (a) `add` happy path + stale-clone refusal + MA-9 cleanup, (b) `remove` cascade with mixed per-plugin success/failure, (c) `list` empty-state, (d) `update` manifest-pointer refresh + autoupdate cascade gating, (e) `autoupdate`/`noautoupdate` idempotent flips, (f) reload-hint suppression on no-op operations, (g) soft-dep warning composition with mocked `pi.getAllTools()`.

</domain>

<decisions>
## Implementation Decisions

### Orchestrator Layout (D-01)

- **D-01 (5 files + shared.ts under `orchestrators/marketplace/`):** Each PRD subcommand gets a 1:1 file mapping for grep-ability and test localization.
  - `add.ts` -- MA-1..6, MA-8..11 (uses `gitOps.clone` for GitHub; `pathSource`/`githubSource` factories from `domain/source.ts`)
  - `remove.ts` -- MR-1..8 (cross-scope ambiguity resolution, cascade drop, post-state cleanup aggregation)
  - `list.ts` -- ML-1..4 (no manifest reads; reads state only; reuses `presentation/` formatters when they land in Phase 6)
  - `update.ts` -- MU-1..9 + autoupdate-gated cascade (accepts injected `PluginUpdateFn`)
  - `autoupdate.ts` -- MAU-1..4 (single file handles both `autoupdate` and `noautoupdate` via a boolean parameter; idempotent flip with `Already enabled/disabled: ...` reporting)
  - `shared.ts` -- cross-command helpers: cascade primitive for per-plugin unstage aggregation, `GitOps` interface + default export, scope resolution (`resolveScopeFromArg`/`resolveScopeFromState`), source-record validation funnel (ST-6), `applyAutoupdateFlip` (used by both `autoupdate.ts` and the `marketplace update` cascade reset)

### Cascade Composition (D-02, D-03)

- **D-02 (Hand-rolled try/catch loop in `shared.ts`, NOT `runPhases`):** `marketplace remove`'s cascade iterates the marketplace's installed plugins via a plain `for ... of ...` loop with a per-plugin `try { await cascadeUnstagePlugin(plugin, locations) } catch (e) { failedPlugins.push({ plugin, cause: e }) }` envelope. The `runPhases<C>` ledger from Phase 2 D-01 is the **wrong shape** for this requirement: ledger phases halt and roll back on first throw, but MR-3 explicitly says cascade continues across per-plugin failures and aggregates them into `failedPlugins[]`. The cascade primitive lives in `orchestrators/marketplace/shared.ts` as `cascadeUnstagePlugin(plugin: string, marketplace: string, locations: ScopedLocations): Promise<UnstageOutcome>`. Phase 5 reuses the same primitive when it ships plugin `uninstall` (consult `orchestrators/marketplace/shared.ts` from Phase 5; do not duplicate).
- **D-03 (Fail-fast per plugin):** Within one plugin's 4-bridge cascade, the FIRST bridge throw halts that plugin's cascade and the plugin lands in `failedPlugins[]` with the chained cause (`Error.cause` per ES-4). Skills/prompts already unstaged stay unstaged -- bridge unstage primitives are idempotent and bridges retain index entries on foreign-content (D-06 corollary in Phase 3). Per-plugin user-visible failure message is one cause per failed plugin (flat `failedPlugins[]`), not a tree of per-bridge failures. Matches MR-3's `Error.cause` chaining + MR-4's single-aggregated-warning format exactly.
- **D-03 corollary (cascade ordering inside a single plugin):** Mirror PRD §5.2.2 PU-1 uninstall order -- skills/prompts → agents → MCP servers. This is the inverse of the install order but the same as plugin uninstall. Phase 4's cascade is functionally "uninstall every plugin in this marketplace, then drop the marketplace record" -- so per-plugin order MUST match PU-1.

### State-Guard Boundary (D-04)

- **D-04 (One `withStateGuard` per mutating orchestrator, wrapping the entire flow):** Each mutating subcommand (`add`, `remove`, `update`, `autoupdate`) opens a single `withStateGuard(scope, async (state) => { ... })` that wraps parse, network IO (for `add`/`update`), in-memory mutation, and the final save. Concurrent-add detection (state has the name when our snapshot didn't) and concurrent-remove detection (state lacks the name when our snapshot had it) both surface at the guard's save boundary naturally. `list` reads fresh state WITHOUT a guard (read-only).
- **D-04 corollary (network IO inside the guard):** The guard wraps `gitOps.clone` for `add` and `gitOps.fetch`/`gitOps.checkout` for `update`. This is intentional: it eliminates the TOCTOU window where a stale-clone check (MA-6) passes at plan time but the directory now exists at commit time. Phase 2 D-02's outer-guard/inner-ledger composition pattern still holds -- Phase 4 just doesn't use the ledger (D-02).

### Phase 4 → Phase 5 Cascade Hand-off (D-05 through D-08)

- **D-05 (Function-injection seam for `PluginUpdateFn`):** `orchestrators/marketplace/update.ts` accepts a `pluginUpdate: PluginUpdateFn` parameter; the autoupdate cascade calls it once per installed plugin. No import from `orchestrators/marketplace/` into `orchestrators/plugin/` is needed -- the type lives in a layer-neutral file (D-06). Phase 7's `index.ts` injects Phase 5's real implementation; tests inject mocks. Phase 4 ships `marketplace update` end-to-end (non-autoupdate fully working; autoupdate cascade verified via mock injection).
- **D-06 (`PluginUpdateFn` + `PluginUpdateOutcome` types live in `orchestrators/types.ts`):** New cross-orchestrator types file at `orchestrators/types.ts` (root of the `orchestrators/` layer). Both Phase 4 (marketplace/update.ts) and Phase 5 (plugin/update.ts) import from this file -- no cycle. Mirrors Phase 3 D-01's escalation note about a future `BridgeOps<Prep, Target>` belonging at this same path. The signature is `(plugin: string, marketplace: string, scope: Scope) => Promise<PluginUpdateOutcome>`; `PluginUpdateOutcome` is a discriminated union with `{ partition: 'updated' | 'unchanged' | 'skipped' | 'failed', name, fromVersion?, toVersion?, notes? }` matching MU-7.
- **D-07 (Cascade plugin enumeration is state-driven, not manifest-driven):** After the manifest pointer is refreshed and persisted inside the marketplace's state-guard (MU-4), `marketplace update`'s cascade reads `state.marketplaces[mp].plugins` keys to determine the plugin set to update. New manifest entries that aren't in state are ignored (MU-8 satisfied by construction -- the cascade never sees them). The injected `PluginUpdateFn` is called once per installed plugin; its return value indicates the partition. Failures during the per-plugin call land in the `failed` partition with chained cause (MU-7 rendering order: `updated` → `unchanged` → `skipped` → `failed`).
- **D-08 (Cascade runs OUTSIDE the marketplace's state-guard):** The marketplace's outer guard wraps ONLY the manifest-pointer refresh + autoupdate-flag readback + persist (MU-4 literal: "persisted before any plugin cascade runs"). Guard closes; cascade loop runs; each `PluginUpdateFn` call opens its own state-guard internally (Phase 5's concern, not Phase 4's). Avoids nested state-guards (Phase 2 D-02 doesn't define nested-guard semantics). The cascade reads the plugin list from a snapshot captured INSIDE the outer guard before it closes, so a concurrent removal between guards is detected by each per-plugin guard naturally.

### Clone-Then-Rename Staging (D-09 through D-11)

- **D-09 (Staging at `<scopeRoot>/claude-marketplace/sources-staging/<uuid>/`):** Same-FS guarantee by construction -- the staging dir is a sibling of the final `sources/` dir, both under `<scopeRoot>/claude-marketplace/`. The atomic-rename target `<scopeRoot>/claude-marketplace/sources/<name>/` is on the same filesystem regardless of how Pi's scope roots are mounted. New helper `sourcesStagingDir(loc: ScopedLocations, uuid: string): string` added to `persistence/locations.ts` (returns the absolute path; goes through `assertPathInside` against `<scopeRoot>/claude-marketplace/` to satisfy PS-1 + SC-7). UUID generated via `node:crypto.randomUUID()` (Phase 3 precedent for agent-staging UUIDs).
- **D-10 (Reuse `shared/fs-utils.cleanupStaging` + `shared/errors.appendLeakToError`):** MA-9's "clone succeeds but manifest read or state save fails" path delegates cleanup to the existing `cleanupStaging(dir, label)` function shipped in Phase 3. Cleanup failures return a leak descriptor string; `appendLeakToError(originalError, leakDescriptor)` from `shared/errors.ts` chains it. No new error infrastructure -- one consistent surface across Phase 3 bridges and Phase 4 orchestrators.
- **D-11 (MA-6 stale-clone check happens BEFORE clone, on final `sources/<name>/`):** Before `gitOps.clone(stagingDir)`, check whether `<scopeRoot>/claude-marketplace/sources/<name>/` exists AND is non-empty. If yes, throw with `"stale source clone at <path>"` (MA-6 canonical message). Single check at flow start; no race window between check and rename; user-visible failure surfaces before any network IO is wasted. MA-8 (same name in state) is a separate check on `state.marketplaces[<name>]` -- both checks run before clone.

### Network Seam (D-12, D-13)

- **D-12 (`GitOps` interface in `orchestrators/marketplace/shared.ts`; orchestrators accept it as injected parameter):** Each network-touching orchestrator (`add.ts`, `update.ts`) accepts an optional `gitOps?: GitOps` parameter that defaults to a const re-export of the relevant `platform/git.ts` functions. Tests pass an in-memory mock. Mirrors D-05's `PluginUpdateFn` injection pattern for consistency. The `GitOps` type is **local to `orchestrators/marketplace/shared.ts`** -- not in `orchestrators/types.ts` -- because only marketplace orchestrators touch git (plugin orchestrators in Phase 5 do not).
- **D-13 (`GitOps` surface: `clone` + `fetch` + `checkout` + `resolveRef` + `forceUpdateRef`):** Five primitives. `clone` for `add` (MA-5); `fetch` to refresh remote refs at the start of `update`; `checkout` to move HEAD to a SHA or branch; `resolveRef` to resolve a stored ref against the updated `refs/remotes/origin/*` after fetch; `forceUpdateRef` to update the local branch ref to match the new remote SHA before checkout (enables the "follow upstream blindly" semantics in D-14). NO `pull` -- the fast-forward-or-fail semantics encoded in `pull --ff-only` are explicitly NOT what Phase 4 wants (see D-14).

### User-Contract Change: Follow Upstream Blindly (D-14)

- **D-14 (Override of PRD MU-2/MU-3 literal text; mirrors Phase 1 D-21 pattern):** The local marketplace clone is read-only by contract -- the extension only clones, fetches, and checks out; it never commits, pushes, or modifies the working tree. There is no local work to "clobber" and no scenario where local-vs-upstream divergence is a real user concern. `marketplace update` therefore follows upstream blindly:
  1. `gitOps.fetch` to update remote refs.
  2. For symbolic HEAD (stored ref is a branch name): `forceUpdateRef` the local branch to the new `refs/remotes/origin/<branch>` SHA, then `checkout` it.
  3. For detached HEAD (stored ref is a SHA): `checkout <sha>`. If the SHA no longer exists on the remote (rewritten history), `checkout` fails; surface as a typed `MarketplaceUpdateError` with the chained cause (no `instanceof` introspection of isomorphic-git errors -- the resolution is the same for any failure mode).
  Replaces MU-2's literal `git pull --ff-only` choreography and MU-3's "Non-fast-forward divergence MUST surface as an error" requirement. Recorded as a deliberate user-contract change.
- **D-14 supersession effect:** REQUIREMENTS.md MU-2 and MU-3 get strike-through with "(superseded by Phase 4 D-14: follow-upstream-blindly semantics; clone is read-only by contract)". PROJECT.md Key Decisions table gets a new row noting the supersession and rationale. PRD §5.1.4 retains the original MU-2/MU-3 text as historical baseline (PRD is the spec snapshot, not the current contract) -- the supersession is recorded in `.planning/` artifacts only, parallel to how D-21 handled MA-7.
- **D-14 corollary (MU-5 still applies):** "If the clone advanced but the manifest save failed, the error message MUST tell the user 'Retry the command.'" remains binding -- this is a state-vs-disk consistency concern, not a git-divergence concern. Phase 4's `update.ts` retains this exact recovery hint when the post-fetch manifest save throws inside the state-guard.

### Claude's Discretion

The user signed off on recommended options for layout (D-01), cascade composition (D-02, D-03), state-guard boundary (D-04), seam shape (D-05, D-06, D-07, D-08), staging location (D-09, D-10, D-11), and the `GitOps` interface placement (D-12). The user explicitly directed the "follow upstream blindly" semantic (D-14) -- not Claude's call. The user also picked the marginally heavier `GitOps` surface (D-13 with `forceUpdateRef` included) over the lighter alternative. Escalation notes:

- **D-01:** If a fifth subcommand-shared helper emerges that doesn't fit `shared.ts` (e.g., a per-source-kind dispatcher), promote it to its own file under `orchestrators/marketplace/` rather than thickening `shared.ts`. No file should exceed ~300 LOC.
- **D-02:** If Phase 5's plugin `uninstall` discovers that the per-plugin cascade *should* be a ledger after all (e.g., to roll back partial unstage on the cross-bridge guard fail), the cascade primitive in `shared.ts` can be re-implemented atop `runPhases` without changing its public signature. Phase 4's tests would still pass; the change is local to `cascadeUnstagePlugin`.
- **D-05:** If a third or fourth function-injection seam emerges across orchestrators, consider a typed `OrchestratorDeps` record in `orchestrators/types.ts` rather than threading 4+ parameters per subcommand. Not needed in Phase 4 (only `PluginUpdateFn` and `GitOps`).
- **D-13:** If isomorphic-git's `pull` adds a non-merge "fetch + reset to remote" mode in a future release, the `forceUpdateRef` + `checkout` choreography can collapse to a single call. Phase 4 wraps explicitly because the current isomorphic-git surface requires it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec (PRD)

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.1 -- MA-1..11 marketplace add (MA-7 removed per Phase 1 D-21)
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.2 -- MR-1..8 marketplace remove (cascade aggregation, post-state cleanup ordering)
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.3 -- ML-1..4 marketplace list (no manifest reads)
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.4 -- MU-1, MU-4, MU-5, MU-6..9 marketplace update (MU-2, MU-3 SUPERSEDED by Phase 4 D-14)
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.5 -- MAU-1..4 autoupdate / noautoupdate
- `docs/prd/pi-claude-marketplace-prd.md` §5.4 -- Cascade interaction table (defines when manifest refresh vs plugin cascade runs)
- `docs/prd/pi-claude-marketplace-prd.md` §6.2 -- SC-5, SC-6 scope defaulting (`marketplace add` defaults `user`; bare `marketplace update` runs both scopes)
- `docs/prd/pi-claude-marketplace-prd.md` §6.8 -- RH-1..5 reload hint format + soft-dep probing rules; verbs `load`/`refresh`/`drop`
- `docs/prd/pi-claude-marketplace-prd.md` §6.9 -- ST-1..9 state persistence; ST-7's `withStateGuard` mandate; ST-8/9 concurrency
- `docs/prd/pi-claude-marketplace-prd.md` §6.11 -- AS-1 atomic staging (same-FS guarantee for clone-then-rename)
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 -- ES-1..5 error surfaces; ES-5 marker strings; ES-4 `Error.cause` chain
- `docs/prd/pi-claude-marketplace-prd.md` §9.3 -- Soft-dependency probing flow (`pi.getAllTools()` matching rules)
- `docs/prd/pi-claude-marketplace-prd.md` §10 -- NFR-5 network policy (only `add` and `update` against GitHub touch network)

### Project planning

- `.planning/PROJECT.md` -- Key Decisions table will gain a new row noting MU-2/MU-3 supersession by D-14 at phase transition
- `.planning/REQUIREMENTS.md` -- Phase 4 owns the 38 listed under § "Per-phase counts"; MU-2 and MU-3 will be marked "(superseded by Phase 4 D-14)" at phase transition
- `.planning/ROADMAP.md` lines 93-103 -- Phase 4 goal + 6 success criteria
- `.planning/STATE.md` -- Current state; Phase 3 complete (441 tests, all decisions D-01..D-10 shipped)

### Phase 1 carry-forward (consumed by Phase 4)

- `.planning/phases/01-foundations-toolchain/01-CONTEXT.md` -- D-03 (`write-file-atomic@^8` for JSON), D-06/D-07 (notify wrappers + ESLint output discipline), D-08 (markers), D-11 (import boundaries: `orchestrators/` may import from `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`), D-14..17 (`assertPathInside` with symlink refusal -- every staging-dir computation goes through it), D-18..20 (isomorphic-git wrapper at `platform/git.ts` -- Phase 4 is its first caller), D-21 (MA-7 supersession; precedent for Phase 4 D-14)
- `extensions/claude-marketplace/platform/git.ts` -- isomorphic-git wrapper; exports `clone`, `fetch`, `pull`, `checkout`, `resolveRef`, `listBranches`, `listRemotes`. Phase 4 consumes `clone`/`fetch`/`checkout`/`resolveRef` plus a new `forceUpdateRef` helper (D-13)
- `extensions/claude-marketplace/shared/notify.ts` -- `notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`. Every Phase 4 user-visible message routes through these
- `extensions/claude-marketplace/shared/markers.ts` -- ES-5 strings; `RELOAD_HINT_PREFIX` consumed by `presentation/reload-hint.ts`; `PI_SUBAGENTS_NOT_LOADED`/`PI_MCP_ADAPTER_NOT_LOADED` consumed by `presentation/soft-dep.ts`
- `extensions/claude-marketplace/shared/path-safety.ts` -- `assertPathInside` + `SymlinkRefusedError`; called on every staging dir path
- `extensions/claude-marketplace/shared/atomic-json.ts` -- `atomicWriteJson`; consumed indirectly via `persistence/state-io.ts` (Phase 4 doesn't call it directly)
- `extensions/claude-marketplace/shared/errors.ts` -- `appendLeakToError`, `appendLeaks`, `errorMessage`; Phase 4 adds `MarketplaceUpdateError` and `StaleSourceCloneError` here
- `extensions/claude-marketplace/shared/fs-utils.ts` -- `cleanupStaging`, `pathExists`; Phase 4's MA-9 cleanup path consumes both

### Phase 2 carry-forward (consumed by Phase 4)

- `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md` -- D-01 (`runPhases<C>` available but NOT used by Phase 4 per D-02), D-02 (`withStateGuard`), D-06 (source parser factories `pathSource`/`githubSource`), D-09 (state shape `{marketplaces: {<mp>: {plugins: {…}}}}`), D-10 (independent per-scope state)
- `extensions/claude-marketplace/domain/source.ts` -- `parsePluginSource` + `pathSource` + `githubSource` factories; Phase 4's `add.ts` calls these for MA-1/MA-10 source validation
- `extensions/claude-marketplace/domain/manifest.ts` -- `MARKETPLACE_VALIDATOR` (JIT-compiled TypeBox); `add.ts` and `update.ts` call it after reading the cloned `marketplace.json`
- `extensions/claude-marketplace/persistence/locations.ts` -- `ScopedLocations` brand + `locationsFor(scope, cwd)`; new `sourcesStagingDir(loc, uuid)` helper added in Phase 4 per D-09
- `extensions/claude-marketplace/persistence/state-io.ts` -- `STATE_SCHEMA`, `STATE_VALIDATOR`, `DEFAULT_STATE`, `loadState`, `saveState`; Phase 4 mutates state via `withStateGuard` closures
- `extensions/claude-marketplace/persistence/migrate.ts` -- `migrateLegacyMarketplaceRecords`, `persistMigratedState`; Phase 4 doesn't call directly (loadState handles it) but ST-4/ST-5 legacy migration semantics affect what Phase 4 reads
- `extensions/claude-marketplace/transaction/with-state-guard.ts` -- `withStateGuard`; Phase 4 wraps every mutating subcommand in this per D-04

### Phase 3 carry-forward (consumed by Phase 4)

- `.planning/phases/03-resource-bridges/03-CONTEXT.md` -- D-01 (per-bridge concrete signatures with opaque handles), D-02 (bridge-as-Phase composition planned for Phase 5, NOT Phase 4 -- Phase 4 uses unstage primitives directly), D-04 (compute-target-then-atomic-apply), D-06 (marker discipline -- agents bridge fails loudly on foreign content; Phase 4 cascade propagates this as a per-plugin failure)
- `extensions/claude-marketplace/bridges/skills/index.ts` -- `unstagePluginSkills` consumed by `cascadeUnstagePlugin`
- `extensions/claude-marketplace/bridges/commands/index.ts` -- `unstagePluginCommands` consumed by `cascadeUnstagePlugin`
- `extensions/claude-marketplace/bridges/agents/index.ts` -- `unstagePluginAgents` consumed by `cascadeUnstagePlugin`; AG-5 foreign-content refusals propagate as per-plugin cause
- `extensions/claude-marketplace/bridges/mcp/index.ts` -- `unstageMcpServers` consumed by `cascadeUnstagePlugin`; MC-5 marker-owned filtering already enforced inside the bridge

### Research foundation (already produced)

- `.planning/research/ARCHITECTURE.md` -- 9-folder layout (orchestrators sit above bridges); literal-array ledger discipline (used by Phase 5, deliberately NOT by Phase 4 per D-02)
- `.planning/research/PITFALLS.md` -- Pitfall 1 (atomicity vs durability -- D-09 same-FS staging mitigates), Pitfall 9 (foreign content -- propagated via cascade `failedPlugins[]`), Pitfall 15 (notify discipline -- all Phase 4 output through `shared/notify.ts`)
- `.planning/research/STACK.md` -- isomorphic-git for git ops; `write-file-atomic` for state.json saves
- `.planning/research/SUMMARY.md` -- Cross-research synthesis; Phase 4 sits between Phase 3 (bridges) and Phase 5 (plugin orchestrators)

### Library docs (planner should pull current versions)

- `isomorphic-git` -- `clone`, `fetch`, `checkout`, `resolveRef`, and ref-update primitives (the docs version of `git writeRef` / branch-update for D-13's `forceUpdateRef`)
- `isomorphic-git/http/node` -- Node HTTP adapter; consumed by `platform/git.ts`
- `node:crypto` -- `randomUUID()` for staging dir UUIDs (Phase 3 precedent)
- `node:fs/promises` -- `rename`, `readdir`, `rm({recursive: true, force: true})`, `stat`, `mkdir({recursive: true})` for staging and cleanup
- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- `ExtensionContext.pi.getAllTools()` signature for the soft-dep probe in `presentation/soft-dep.ts` (RH-3, RH-4)

### V1 reference (read selectively when implementing the same concern)

- `git show features/initial:extensions/claude-marketplace/marketplace/{add,remove,list,update,autoupdate}.ts` -- V1 marketplace orchestrators; pattern reference but NOT a wholesale model. V1 uses `pull --ff-only` (now superseded by D-14); V1's staging location differs from D-09
- `git show features/initial:extensions/claude-marketplace/presentation/{reload-hint,soft-dep}.ts` -- V1 reload-hint + soft-dep composition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 1, 2, 3 outputs)

- **`extensions/claude-marketplace/platform/git.ts`** -- isomorphic-git wrapper with the full clone/fetch/pull/checkout/resolveRef/listBranches/listRemotes surface (Phase 1 D-18..20). Phase 4 consumes a narrower subset (D-13) via the `GitOps` injection seam.
- **`extensions/claude-marketplace/shared/notify.ts`** -- `notifySuccess`, `notifyWarning`, `notifyError(ctx, message, cause?)`, `notifyUsageError`. The `cause?` parameter is how Phase 4 chains `Error.cause` per ES-4. `notifyUsageError` is reserved for Phase 6 (argument parsing); Phase 4 uses the other three.
- **`extensions/claude-marketplace/shared/markers.ts`** -- `RELOAD_HINT_PREFIX`, `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`. `presentation/reload-hint.ts` and `presentation/soft-dep.ts` compose from these constants; orchestrators never inline the literal strings.
- **`extensions/claude-marketplace/shared/path-safety.ts`** -- `assertPathInside(parent, child)` with `SymlinkRefusedError`. Every staging-dir computation (D-09's `sourcesStagingDir`) and every final `sources/<name>/` write goes through this.
- **`extensions/claude-marketplace/shared/fs-utils.ts`** -- `cleanupStaging(dir, label)`, `pathExists(p)`. Phase 4's MA-9 cleanup and MA-6 stale-clone check consume these directly.
- **`extensions/claude-marketplace/shared/errors.ts`** -- `appendLeakToError`, `appendLeaks`, `errorMessage`. Phase 4 ADDS new error types here: `MarketplaceUpdateError` (D-14 update failures), `StaleSourceCloneError` (MA-6 stale-clone refusal), `MarketplaceNotFoundError` (MR-1 cross-scope ambiguity; `marketplace update <name>` when name doesn't exist), `MarketplaceDuplicateNameError` (MA-8 same-name refusal).
- **`extensions/claude-marketplace/domain/source.ts`** -- `parsePluginSource`, `pathSource`, `githubSource` factories. `add.ts` calls these for source kind detection and MA-1/MA-10 validation; `update.ts` reads `state.marketplaces[mp].source` (already a validated `ParsedSource`) and dispatches on `source.kind`.
- **`extensions/claude-marketplace/domain/manifest.ts`** -- `MARKETPLACE_VALIDATOR` (JIT-compiled TypeBox). `add.ts` and `update.ts` read `<marketplaceRoot>/.claude-plugin/marketplace.json` and validate via this; failures surface as `error`-severity with the parse cause chained.
- **`extensions/claude-marketplace/persistence/locations.ts`** -- `ScopedLocations` brand. Phase 4 adds `sourcesStagingDir(loc, uuid)` and `sourcesFinalDir(loc, marketplaceName)` helpers here. Existing helpers cover `marketplaceJsonPath`, etc.
- **`extensions/claude-marketplace/persistence/state-io.ts`** -- `loadState`, `saveState`, `STATE_VALIDATOR`. `withStateGuard` calls these internally; Phase 4 doesn't call them directly.
- **`extensions/claude-marketplace/transaction/with-state-guard.ts`** -- `withStateGuard(scope, fn)`. Every Phase 4 mutating orchestrator wraps its flow in one of these per D-04.
- **`extensions/claude-marketplace/bridges/{skills,commands,agents,mcp}/index.ts`** -- per-bridge `unstage*` exports. `cascadeUnstagePlugin` in `orchestrators/marketplace/shared.ts` calls all four in PU-1 order.

### Established Patterns (carry forward unchanged)

- **TypeScript strict + ESM** -- All Phase 4 modules follow.
- **Import boundaries** -- `orchestrators/` may import from `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. Imports from `edge/` are forbidden. `orchestrators/marketplace/` may import from `orchestrators/` siblings only via `orchestrators/types.ts` (D-06).
- **TypeBox JIT compile at module load** -- Phase 4 doesn't define new schemas; it consumes validators from `domain/manifest.ts` and `persistence/state-io.ts`.
- **`npm run check` pipeline** -- typecheck + ESLint + Prettier + `node --test "tests/**/*.test.ts"` MUST stay green per NFR-6.
- **PRD-as-snapshot-fixture (Phase 1 D-09)** -- `tests/helpers/prd-extract.ts` exists. Phase 4 uses it for reload-hint format assertions (RH-2 verb table) and for the MR-4 aggregated-warning trailer ("fix the underlying issue and retry").
- **Pre-commit hook chain** -- unicode-dash + smartquote + mdformat + markdownlint-cli2 (.claude/ excluded; .planning/ excluded from large-file check). Git commit messages MUST avoid em-dashes (see Phase 3 lessons: em-dash in commit title triggered fix-unicode-dashes hook + caused silent commit failures).

### Integration Points

- **Phase 5 plugin orchestrators (via `orchestrators/types.ts`):** Phase 5's `orchestrators/plugin/update.ts` exports a function matching `PluginUpdateFn`. Phase 7's `index.ts` injects it into `orchestrators/marketplace/update.ts` at registration time. Phase 5's `orchestrators/plugin/uninstall.ts` also reuses `cascadeUnstagePlugin` from `orchestrators/marketplace/shared.ts`.
- **Phase 6 edge layer (via dispatch surface):** Phase 6's `edge/router.ts` calls each Phase 4 orchestrator with parsed args + the injected `gitOps` / `pluginUpdate` / `ctx`. Phase 4's orchestrators are pure functions of `(ctx, args, deps)`; they do not register pi commands themselves.
- **Phase 7 `index.ts` (injection wiring):** The extension entrypoint wires `platform/git.ts` exports into the default `GitOps` and Phase 5's `pluginUpdate` into the orchestrator parameter at registration.
- **`pi.getAllTools()` probing for soft-deps (RH-3, RH-4):** `presentation/soft-dep.ts` exports `hasLoadedPiSubagents(ctx)` and `hasLoadedPiMcpAdapter(ctx)` (or a unified `softDepStatus(ctx)` returning `{ subagentsLoaded, mcpAdapterLoaded }`). Each orchestrator decides which warnings to compose based on whether the relevant resource kind was actually staged/dropped. Phase 4 is the first consumer; Phase 5 reuses.
- **State recording:** `marketplace add` writes a fresh marketplace record under `state.marketplaces[<name>]` with `plugins: {}`. `marketplace remove` deletes the record (or retains it with the failed-plugin subset per MR-3). `marketplace update` rewrites `state.marketplaces[<name>].manifestPath`/`.marketplaceRoot`/`.lastUpdatedAt`. `autoupdate`/`noautoupdate` flips `state.marketplaces[<name>].autoupdate`.

</code_context>

<specifics>
## Specific Ideas

- **`cascadeUnstagePlugin` taxonomy** -- Single public function in `orchestrators/marketplace/shared.ts`. Tests under `tests/orchestrators/marketplace/cascade.test.ts` cover: (a) all four bridges succeed → returns `{ ok: true, dropped: [...] }`; (b) skills succeed, agents throw → returns `{ ok: false, cause }` and skills stay unstaged; (c) all four bridges throw → returns `{ ok: false, cause }` with the first throw chained.
- **`marketplace add` test taxonomy** -- `tests/orchestrators/marketplace/add.test.ts` covers MA-1 (each source kind parses), MA-2 (scope defaulting to `user`), MA-5 (clone-then-rename with mocked `GitOps.clone`), MA-6 (stale-clone refusal), MA-8 (duplicate name in state), MA-9 (manifest read failure → cleanup runs → leak surfaced), MA-10 (each reject case from PRD §5.1.1), MA-11 (success message + NO reload hint).
- **`marketplace update` test taxonomy** -- `tests/orchestrators/marketplace/update.test.ts` covers MU-1 (empty scope silent + no reload hint), MU-4 (manifest persisted before cascade), MU-5 (post-clone manifest save failure → "Retry the command."), MU-6 (autoupdate flag gates cascade), MU-7 (partition rendering order via mocked `PluginUpdateFn`), MU-8 (new manifest entries not auto-installed), MU-9 (reload hint composition + soft-dep warning interleaving), and D-14 (follow-upstream-blindly for force-pushed remote and detached-HEAD SHA-no-longer-exists).
- **`marketplace remove` test taxonomy** -- `tests/orchestrators/marketplace/remove.test.ts` covers MR-1 (cross-scope ambiguity error), MR-3 (per-plugin failure aggregation into `failedPlugins[]` with chained cause), MR-4 (one aggregated `warning`-severity notification with "fix the underlying issue and retry" trailer), MR-5 (post-state cleanup of per-plugin/marketplace/GitHub dirs), MR-7 (GitHub clone dir retained when any plugin failed), MR-8 (reload hint emitted only when ≥1 plugin's resources were actually removed).
- **`autoupdate`/`noautoupdate` test taxonomy** -- `tests/orchestrators/marketplace/autoupdate.test.ts` covers MAU-1 (single-name flip), MAU-2 (bare-form scope semantics), MAU-3 (idempotent flip emits "Already enabled/disabled" message), MAU-4 (missing/undefined flag treated as `false` on round-trip).
- **`presentation/reload-hint.ts` snapshot test** -- `tests/presentation/reload-hint.test.ts` asserts the verb table (`load`/`refresh`/`drop`) and the singular/plural form per RH-2 (`Run /reload to <verb> it.` for one name; `Run /reload to <verb> "n1", "n2".` for N). PRD-as-snapshot-fixture verifies the prefix is byte-for-byte equal to PRD §6.8 RH-2.
- **`presentation/soft-dep.ts` mock-`pi.getAllTools()` test** -- `tests/presentation/soft-dep.test.ts` exercises RH-3 (`subagent` tool present → loaded) and RH-4 (`mcp` tool name OR `sourceInfo.source` substring-match for `pi-mcp-adapter`). Mock `ctx.pi.getAllTools()` to return fixture tool lists.
- **`GitOps` mock harness** -- `tests/helpers/git-mock.ts` exports a `makeMockGitOps(state)` factory returning a `GitOps` impl that exercises stored-ref bookkeeping in-memory. Tests can mutate the mock state between calls to simulate force-push (`forceUpdateRef` then assert downstream `checkout` lands on the new SHA) and ref-deletion (mock `checkout` throws when stored ref is missing).
- **D-14 supersession PRs** -- The Phase 4 plan will include one task that updates REQUIREMENTS.md to mark MU-2/MU-3 superseded and adds a PROJECT.md Key Decisions row. Pattern follows the Phase 1 plan that landed D-21 (MA-7 supersession).

</specifics>

<deferred>
## Deferred Ideas

- **`marketplace info <name>`** -- PRD §11 deferral; "info subcommand" is post-V1. Not Phase 4.
- **JSON output / dry-run modes for `marketplace add/remove/update`** -- PRD §11 deferral. The orchestrator return shapes (`{ ok, cleanupWarnings?, dropped?, failedPlugins? }`) are JSON-serializable, so a future `--json` flag in Phase 6's edge layer can render them without changing Phase 4 internals.
- **Manifest-mtime caching (NFR-8 BACKLOG)** -- `marketplace list` re-reads no manifests (ML-3), so the BACKLOG perf item lands in `list` (top-level) in Phase 5. Phase 4's `marketplace list` doesn't touch manifests at all.
- **Session-start autoupdate run** -- PRD §11 deferral ("Claude Code parity"). Phase 4 implements `autoupdate`/`noautoupdate` flag flips and the gated cascade; it does NOT register a session-start hook.
- **MR-1 disambiguation interactive prompt** -- PRD §5.1.2 MR-1 specifies a disambiguation error when `--scope` is omitted and the name exists in both scopes. Interactive prompting (e.g., "Which scope?") is PRD §11 deferred ("rich interactive selectors"). Phase 4 throws the disambiguation error with a clear "specify --scope user or --scope project" hint; rich interaction is post-V1.
- **`--force` overwrite for stale source clone (MA-6)** -- Phase 4 enforces the refusal verbatim. A future `--force` flag that cleans the stale dir before retry is plausible UX but post-V1 (PRD §11 deferral of "--force install with `incomplete` state" precedent).
- **`marketplace update` cascade for `marketplace update` without a name** -- MU-1 says bare form refreshes every marketplace in scope, then per-marketplace cascade gates on each flag. Phase 4 ships this end-to-end via the injected `PluginUpdateFn`. The deferred concern is parallelism: do all marketplaces refresh sequentially or in parallel? Phase 4 implements sequentially (simpler reasoning; preserves notification ordering); parallel refresh is a perf optimization deferred until measured.
- **Telemetry for cascade failure rates** -- IL-4 forbids telemetry V1. The structured `failedPlugins[]` shape is suitable for a future event channel (IL-5) without rework.
- **MU-2/MU-3 retention in PRD §5.1.4** -- D-14 supersedes the literal text in `.planning/` artifacts. A future PRD v2 revision can rewrite §5.1.4 to match D-14 directly; for V1 the supersession lives in REQUIREMENTS.md and PROJECT.md per the D-21 pattern. Tracked here so a future PRD editor knows the contract change exists.

</deferred>

______________________________________________________________________

*Phase: 4-Marketplace Orchestrators*
*Context gathered: 2026-05-10*
