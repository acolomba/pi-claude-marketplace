# Phase 4: Marketplace Orchestrators - Research

**Researched:** 2026-05-10
**Domain:** Marketplace lifecycle orchestrators on top of Phase 1-3 foundations (isomorphic-git, atomic JSON IO, withStateGuard, four resource bridges)
**Confidence:** HIGH (every implementation surface verified against the on-disk Phase 1-3 codebase; isomorphic-git and write-file-atomic versions confirmed against npm registry; PRD/REQUIREMENTS/CONTEXT cross-referenced for every claim)

______________________________________________________________________

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 (5 files + shared.ts under `orchestrators/marketplace/`):** Each PRD subcommand gets a 1:1 file mapping for grep-ability and test localization.
- `add.ts` -- MA-1..6, MA-8..11
- `remove.ts` -- MR-1..8
- `list.ts` -- ML-1..4
- `update.ts` -- MU-1..9 + autoupdate-gated cascade (accepts injected `PluginUpdateFn`)
- `autoupdate.ts` -- MAU-1..4 (single file handles both `autoupdate` and `noautoupdate` via a boolean parameter; idempotent flip with `Already enabled/disabled: ...`)
- `shared.ts` -- cross-command helpers: `cascadeUnstagePlugin`, `GitOps` interface + default, scope resolution helpers, source-record validation funnel, `applyAutoupdateFlip`

**D-02 (Hand-rolled try/catch loop in `shared.ts`, NOT `runPhases`):** `marketplace remove`'s cascade iterates the marketplace's installed plugins via a plain `for ... of ...` loop with a per-plugin try/catch envelope. The `runPhases<C>` ledger from Phase 2 D-01 is the wrong shape: ledger phases halt and roll back on first throw, but MR-3 explicitly requires continuing across per-plugin failures and aggregating into `failedPlugins[]`. The cascade primitive lives in `shared.ts` as `cascadeUnstagePlugin(...)`. Phase 5 reuses the same primitive when it ships plugin `uninstall`.

**D-03 (Fail-fast per plugin):** Within one plugin's 4-bridge cascade, the FIRST bridge throw halts that plugin's cascade and the plugin lands in `failedPlugins[]` with the chained cause (`Error.cause` per ES-4). Skills/prompts already unstaged stay unstaged. Per-plugin user-visible failure message is one cause per failed plugin.

**D-03 corollary:** Mirror PRD §5.2.2 PU-1 uninstall order -- skills/prompts → agents → MCP servers.

**D-04 (One `withStateGuard` per mutating orchestrator, wrapping the entire flow):** Each mutating subcommand opens a single `withStateGuard(scope, async (state) => { ... })` that wraps parse, network IO, in-memory mutation, and the final save. `list` reads fresh state WITHOUT a guard.

**D-04 corollary:** The guard wraps `gitOps.clone` for `add` and `gitOps.fetch`/`gitOps.checkout` for `update` -- intentional, eliminates the TOCTOU window where MA-6's stale-clone check passes at plan time but the directory now exists at commit.

**D-05 (Function-injection seam for `PluginUpdateFn`):** `orchestrators/marketplace/update.ts` accepts a `pluginUpdate: PluginUpdateFn` parameter; the autoupdate cascade calls it once per installed plugin. Phase 7's `index.ts` injects Phase 5's real implementation; tests inject mocks.

**D-06 (`PluginUpdateFn` + `PluginUpdateOutcome` types live in `orchestrators/types.ts`):** New cross-orchestrator types file at the root of the `orchestrators/` layer. Signature: `(plugin: string, marketplace: string, scope: Scope) => Promise<PluginUpdateOutcome>`; `PluginUpdateOutcome` is a discriminated union `{ partition: 'updated' | 'unchanged' | 'skipped' | 'failed', name, fromVersion?, toVersion?, notes? }` matching MU-7.

**D-07 (Cascade plugin enumeration is state-driven):** After the manifest pointer is refreshed and persisted inside the marketplace's state-guard (MU-4), `marketplace update`'s cascade reads `state.marketplaces[mp].plugins` keys. New manifest entries that aren't in state are ignored (MU-8 satisfied by construction).

**D-08 (Cascade runs OUTSIDE the marketplace's state-guard):** The marketplace's outer guard wraps ONLY the manifest-pointer refresh + autoupdate-flag readback + persist. Guard closes; cascade loop runs; each `PluginUpdateFn` call opens its own state-guard internally.

**D-09 (Staging at `<scopeRoot>/pi-claude-marketplace/sources-staging/<uuid>/`):** Same-FS guarantee by construction. New helper `sourcesStagingDir(loc, uuid)` added to `persistence/locations.ts`. UUID via `node:crypto.randomUUID()`.

**D-10 (Reuse `shared/fs-utils.cleanupStaging` + `shared/errors.appendLeakToError`):** MA-9 cleanup uses Phase 3 helpers. Cleanup failures return a leak descriptor string; `appendLeakToError(originalError, leakDescriptor)` chains it.

**D-11 (MA-6 stale-clone check happens BEFORE clone, on final `sources/<name>/`):** Single check at flow start; no race window between check and rename. MA-8 (same name in state) is a separate check on `state.marketplaces[<name>]`; both checks run before clone.

**D-12 (`GitOps` interface in `orchestrators/marketplace/shared.ts`):** Each network-touching orchestrator (`add.ts`, `update.ts`) accepts an optional `gitOps?: GitOps` parameter that defaults to a const re-export of `platform/git.ts` functions. Tests pass an in-memory mock. The `GitOps` type is local to `orchestrators/marketplace/shared.ts` (only marketplace orchestrators touch git).

**D-13 (`GitOps` surface):** `clone` + `fetch` + `checkout` + `resolveRef` + `forceUpdateRef`. NO `pull`.

**D-14 (Override of PRD MU-2/MU-3 -- "follow upstream blindly"):**
1. `gitOps.fetch` to update remote refs.
2. For symbolic HEAD (stored ref is a branch name): `forceUpdateRef` the local branch to the new `refs/remotes/origin/<branch>` SHA, then `checkout` it.
3. For detached HEAD (stored ref is a SHA): `checkout <sha>`. If the SHA no longer exists (rewritten history), `checkout` fails; surface as a typed `MarketplaceUpdateError` with the chained cause.

**D-14 supersession:** REQUIREMENTS.md MU-2/MU-3 marked superseded by Phase 4 D-14; PROJECT.md Key Decisions row added; PRD §5.1.4 retains original text as historical baseline.

**D-14 corollary (MU-5 still applies):** "If the clone advanced but the manifest save failed, the error message MUST tell the user 'Retry the command.'" remains binding -- state-vs-disk consistency, not git-divergence.

### Claude's Discretion

The user signed off on recommended options for D-01..D-13. The user explicitly directed the "follow upstream blindly" semantic (D-14) and picked the marginally heavier `GitOps` surface with explicit `forceUpdateRef` (D-13).

Escalation notes carried forward:
- **D-01:** If a fifth subcommand-shared helper emerges that doesn't fit `shared.ts`, promote to its own file. No file should exceed ~300 LOC.
- **D-02:** If Phase 5 plugin `uninstall` needs ledger semantics, re-implement `cascadeUnstagePlugin` atop `runPhases` without changing its public signature.
- **D-05:** If a third or fourth function-injection seam emerges, consider a typed `OrchestratorDeps` record. Not needed in Phase 4.
- **D-13:** If isomorphic-git's `pull` adds a non-merge "fetch + reset to remote" mode in a future release, the `forceUpdateRef` + `checkout` choreography can collapse to a single call.

### Deferred Ideas (OUT OF SCOPE)

- `marketplace info <name>` (PRD §11)
- JSON output / dry-run modes for `marketplace add/remove/update` (PRD §11)
- Manifest-mtime caching (NFR-8 BACKLOG)
- Session-start autoupdate run (PRD §11 "Claude Code parity")
- MR-1 disambiguation interactive prompt (PRD §11 rich interactive selectors)
- `--force` overwrite for stale source clone (post-V1 UX)
- Parallel marketplace refresh in bare-form `marketplace update` (sequential in V1)
- Telemetry for cascade failure rates (IL-4)
- MU-2/MU-3 retention in PRD §5.1.4 (D-14 supersedes in `.planning/` artifacts; PRD v2 rewrite is post-V1)

</user_constraints>

______________________________________________________________________

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MA-1** | Accept `owner/repo`, `https://github.com/...`, and any local path | Source already classified by `parsePluginSource` (verified in `domain/source.ts`); `add.ts` dispatches on `source.kind`. |
| **MA-2** | When `--scope` is omitted, default `add` to `user` | Edge layer (Phase 6) parses; orchestrator receives a fully-resolved `Scope`. SC-5 mirrors. |
| **MA-3** | Local paths accept dir-or-direct-file-path to `marketplace.json` | Already encoded in V1's `loadMarketplaceManifest` resolution; Phase 4 calls the same shape via `manifest.ts` (path source dispatch). |
| **MA-4** | Store paths in portable form -- `~` preserved verbatim | Already enforced by `pathSource()` factory + ST-6 funnel (verified in `domain/source.ts:170`). |
| **MA-5** | GitHub: clone into `<staging>/<uuid>/`, read manifest, atomic-rename | D-09 staging dir + `gitOps.clone(stagingDir)` + `MARKETPLACE_VALIDATOR.Check` + `fs.rename(stagingDir, finalDir)`. |
| **MA-6** | Non-empty target at `sourceCloneDir(name)` from prior failed add MUST fail with "stale source clone" | D-11: single `pathExists(finalDir)` + non-empty check BEFORE `gitOps.clone`. New `StaleSourceCloneError` in `shared/errors.ts`. |
| ~~MA-7~~ | ~~Missing `git` on PATH~~ | **Superseded by Phase 1 D-21** (isomorphic-git eliminates the failure mode). |
| **MA-8** | Duplicate name in chosen scope MUST fail | Pre-clone check on `state.marketplaces[<name>]` (read inside the outer guard). New `MarketplaceDuplicateNameError`. |
| **MA-9** | Manifest read or state save failure after clone MUST clean up; cleanup failures appended | D-10: `cleanupStaging(stagingDir, "marketplace clone")` + `appendLeakToError`. The atomic `rename(staging, final)` is reversible only by `cleanupStaging(finalDir, ...)` if the rename committed and a later step throws. |
| **MA-10** | Reject SSH/arbitrary URLs/`owner/repo@<ref>`/browser-paste with hints | Already enforced by `parsePluginSource` returning `kind: 'unknown', reason: ...`. `add.ts` throws on `kind === 'unknown'`. |
| **MA-11** | Successful add emits `Added marketplace "<name>" in <scope> scope.` and MUST NOT emit reload hint | Composed via `notifySuccess` (no `reloadHint` call). RH-1 gate satisfied by construction. |
| **MR-1** | Without `--scope`: cross-scope ambiguity error | `resolveScopeFromState(name, userLoc, projectLoc)` in `shared.ts` reads both states, throws on ambiguity. |
| **MR-2** | Drop installed-plugin staged resources for every plugin, then drop record | Cascade calls `cascadeUnstagePlugin` per plugin in PRD §5.2.2 PU-1 order; record drop is a state mutation inside `withStateGuard`. |
| **MR-3** | Per-plugin failures collected with `Error.cause`; record retained when any plugin failed | D-02/D-03: hand-rolled try/catch loop builds `failedPlugins[]: { name, cause }[]`; record is dropped only if `failedPlugins.length === 0`. |
| **MR-4** | ONE aggregated `warning`-severity notification, ending with "fix the underlying issue and retry" | Single `notifyWarning(ctx, body)` call after the state-guard returns; body is a multi-line string built from `failedPlugins`. |
| **MR-5** | Post-state cleanup of per-plugin data dirs + marketplace data dir + GitHub clone dir | Iterate `cleanedPluginNames`, call `rm({recursive:true, force:true})` on each; on full success also rm `marketplaceDataDir(name)` + `sourceCloneDir(name)` (only for github source). |
| **MR-6** | Post-state cleanup failures aggregated into one "removed but post-state cleanup failed for N path(s)" error | Collect leaks into `cleanupFailures: string[]`; throw `Error("Marketplace removed but post-state cleanup failed for N path(s): <list>")` if any. |
| **MR-7** | GitHub clone dirs retained when any plugin cleanup failed | The `failedPlugins.length === 0` gate around the `sourceCloneDir` rm; same gate as the marketplaceDataDir rm. |
| **MR-8** | Successful removal emits reload hint (verb: `drop`) listing dropped plugins, only when ≥1 plugin's resources actually removed | RH-1: `dropped` (=`removedPlugins`) is the union of skills/commands/agents/mcp-removed names; if empty, no hint. |
| **ML-1** | One line per marketplace, grouped by scope | `presentation/marketplace-list.ts` (Phase 4 ships this) reads from state, groups by scope. |
| **ML-2** | `<icon> <name> (<source.logical>) [autoupdate]?` | V1 reference: filled-circle `●`; `[autoupdate]` suffix when flag is true. |
| **ML-3** | MUST NOT load each marketplace's manifest | Reads only state; no `loadMarketplaceManifest` calls. |
| **ML-4** | Empty case: `No marketplaces configured.` | When both scopes are empty, emit this exact string via `notifySuccess`. |
| **MU-1** | Bare form refreshes every marketplace; empty silent succeed with `No marketplaces configured.`; NO reload hint | Iterate target scopes (SC-6); empty -> succeed silently with marker string; no reload hint when nothing changed. |
| ~~MU-2~~ | ~~`git fetch` then `git pull --ff-only` or re-checkout stored ref~~ | **Superseded by D-14** -- follow-upstream-blindly via fetch + forceUpdateRef + checkout. |
| ~~MU-3~~ | ~~Non-fast-forward divergence MUST surface as error~~ | **Superseded by D-14** -- local clone is read-only, no divergence is possible. |
| **MU-4** | Manifest pointer re-read and persisted BEFORE any plugin cascade | D-08: outer state-guard wraps refresh + persist; closes; THEN cascade. |
| **MU-5** | Clone advanced but manifest save failed → error MUST tell user "Retry the command." | Inside the outer guard, if manifest validation/save throws and `cloneAdvanced === true`, wrap as `MarketplaceUpdateError(..., 'Retry the command.')`. |
| **MU-6** | Plugin upgrade cascade runs only when per-marketplace `autoupdate` flag is true | After the outer guard returns, `if (record.autoupdate === true) cascade(...)`. |
| **MU-7** | Partition into `updated`/`unchanged`/`skipped`/`failed` and render in that order | `PluginUpdateOutcome.partition` (D-06); cascade aggregates into a result object; presentation renders ordered. |
| **MU-8** | Refreshed manifest's new plugins MUST NOT be auto-installed | D-07: cascade enumerates `state.marketplaces[mp].plugins` keys, never the manifest. New entries never seen. |
| **MU-9** | Successful update emits reload hint listing changed plugins; soft-dep warnings appended when applicable | RH-1 (only when `updated[]` non-empty) + RH-5 (soft-dep warnings BEFORE trailing reload hint). |
| **MAU-1** | `autoupdate` sets flag true; `noautoupdate` clears it; default off | Single `applyAutoupdateFlip(state, name?, enable)` helper in `shared.ts`. |
| **MAU-2** | No-name form flips flag for every marketplace in chosen scope (or both scopes when --scope omitted) | Iterates `Object.keys(state.marketplaces)` when `name === undefined`. SC-6 handles cross-scope. |
| **MAU-3** | Idempotent: already-matching → `Already enabled/disabled: ...` | Compare `(record.autoupdate ?? false) === enable` -> push to `unchanged[]`; otherwise to `changed[]`. |
| **MAU-4** | Round-trip through state.json; missing/undefined treated as `false` | `state.marketplaces[name].autoupdate` is `Type.Optional(Type.Boolean())` (verified in `state-io.ts:71`); the `?? false` coalescing is the canonical read. |
| **SC-5** | `marketplace add` defaults to `user` when scope omitted | Edge layer fills the scope; orchestrator receives it. |
| **SC-6** | `marketplace list/update/autoupdate/noautoupdate` (no name) enumerate both scopes when --scope omitted | Each orchestrator accepts `userLocations + projectLocations + scope?` and iterates the matching subset. |
| **RH-1** | Reload hint emitted ONLY when generated resources changed | All four orchestrators gate on a non-empty changed-resource set. `add` never emits (MA-11). |
| **RH-2** | Hint format: single → `Run /reload to <verb> it.`; N names → `Run /reload to <verb> "n1", "n2".`. Verbs: `load`/`refresh`/`drop` | `presentation/reload-hint.ts` exposes `reloadHint(verb, names): string`. |
| **RH-3** | `pi-subagents` detection probes for tool named `subagent` in `pi.getAllTools()` | `presentation/soft-dep.ts::hasLoadedPiSubagents(ctx)`. |
| **RH-4** | `pi-mcp-adapter` detection: tool name `mcp` OR `sourceInfo.source` substring `pi-mcp-adapter` | `presentation/soft-dep.ts::hasLoadedPiMcpAdapter(ctx)`. |
| **RH-5** | Soft dep unloaded + staged resources of that kind exist → canonical warning line BEFORE trailing reload hint | Composition: `body + (subagentWarning ?? '') + (mcpAdapterWarning ?? '') + reloadHint(...)`. |
| **NFR-5** | Network access required only for GitHub-source `add` and `update` | path-source `add`, `list`, `remove`, `autoupdate`/`noautoupdate` MUST NOT call any `gitOps.*` method. |

</phase_requirements>

______________________________________________________________________

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node ≥22 (NFR-4); recommended `>=22.18` for native TS strip.
- **Tech stack:** TypeScript strict; ESM-only.
- **Pi API:** `@mariozechner/pi-coding-agent` peer dep; v0.73.1 in dev.
- **File ops:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1.
- **Recovery model:** No fix may require Pi process restart; `Run /reload` must suffice. All operations idempotent / fail-clean.
- **Network policy:** Network only for GitHub-source `marketplace add` and `update`/`marketplace update` against GitHub-source marketplaces; `install`, `list`, `uninstall`, `marketplace remove`, path-source `marketplace add` MUST NOT touch the network -- NFR-5.
- **Containment:** Refuse writes outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json` -- NFR-10.
- **Quality bar:** `npm run check` must stay green (typecheck + ESLint + Prettier + `node --test`).
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(...)` via `shared/notify.ts` wrappers (`notifySuccess`/`notifyWarning`/`notifyError`). Direct `process.stdout`/`process.stderr` writes forbidden -- IL-2.
- **No telemetry V1; English only V1.**
- **Scope model:** `user` (`~/.pi/agent/`) and `project` (`<cwd>/.pi/`) only.

______________________________________________________________________

## Summary

Phase 4 ships five marketplace lifecycle orchestrators on top of fully-stable Phase 1-3 foundations. Every primitive the orchestrators need exists today: TypeBox-validated state.json with `withStateGuard`, source/manifest factories, four bridge `unstage*` functions, atomic JSON writes, `cleanupStaging`/`appendLeakToError`, isomorphic-git wrapper at `platform/git.ts`, and the marker constants for ES-5 user-contract strings. Phase 4 contributes one new `GitOps` injection seam (with `forceUpdateRef` added per D-13), one new `cascadeUnstagePlugin` primitive, two new presentation helpers (`reload-hint.ts`, `soft-dep.ts`), one new locations helper (`sourcesStagingDir`), four new error classes (`MarketplaceUpdateError`, `StaleSourceCloneError`, `MarketplaceNotFoundError`, `MarketplaceDuplicateNameError`), and the cross-orchestrator `orchestrators/types.ts` types file consumed by Phase 5.

The user-contract change (D-14: follow-upstream-blindly) eliminates V1's MU-3 non-fast-forward divergence handling, which depended on `pull --ff-only` semantics. Without `pull` on the GitOps surface, `marketplace update` becomes a deterministic three-step `fetch` + `forceUpdateRef` (or detached SHA) + `checkout`. This drops one V1 failure mode entirely (no more "non-fast-forward divergence" UX) and makes the implementation simpler than V1's `syncClone`.

The non-trivial design tension is between MR-3's "continue across plugin failures" and Phase 2's `runPhases` ledger (which halts on first throw). D-02 resolves this with a hand-rolled per-plugin try/catch loop in `shared.ts`. The cascade primitive's `(plugin, marketplace, locations) → Promise<UnstageOutcome>` shape is reused by Phase 5's plugin `uninstall`, so the design must be locked here even though only `remove` consumes it in Phase 4.

**Primary recommendation:** Build the seven new files in three task waves: (1) shared primitives (locations helper, error classes, `GitOps` interface, `cascadeUnstagePlugin`, `applyAutoupdateFlip`, `orchestrators/types.ts`); (2) the five orchestrator files in parallel (each consumes only Phase 1-3 + Wave 1 outputs); (3) the two presentation helpers (`reload-hint.ts`, `soft-dep.ts`) and integration tests. Wave 1 unblocks Wave 2; Wave 3 has no consumers in Phase 4 itself but wires the user-visible output every Wave 2 orchestrator emits.

______________________________________________________________________

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source kind classification (path/github/unknown) | `domain` (`source.ts`) | -- | Pure parsing; already implemented Phase 2. |
| Manifest schema validation | `domain` (`manifest.ts`) | -- | TypeBox JIT-compiled; already implemented Phase 2. |
| Manifest read from disk | `orchestrators/marketplace` (`add.ts`, `update.ts`) | `domain` for validator | Orchestrator owns the IO + validator dispatch; domain owns the schema. |
| Git network ops (clone, fetch, checkout, ref-update) | `platform` (`git.ts`) | `orchestrators/marketplace/shared.ts` (GitOps seam) | Platform owns isomorphic-git binding; orchestrator wraps in injectable interface. |
| State load/save + atomic write | `persistence` (`state-io.ts`) | `transaction` (`with-state-guard.ts`) | Persistence owns IO; transaction owns the load/mutate/save lifecycle. |
| Marketplace record lifecycle (add/remove/update record fields) | `orchestrators/marketplace` | `persistence` for state mutation | Mutation logic lives in the orchestrator closure passed to `withStateGuard`. |
| Plugin resource cascade (skills/prompts/agents/mcp unstage) | `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` | `bridges/{skills,commands,agents,mcp}/unstage` | Cascade primitive composes 4 bridge unstage calls in PU-1 order. |
| Plugin update fan-out (Phase 4 → Phase 5 hand-off) | `orchestrators/types.ts::PluginUpdateFn` | injected by Phase 7 `index.ts` | Function-injection seam; no import cycle. |
| Reload hint string formatting | `presentation/reload-hint.ts` | -- | Pure string composition; no IO; consumed by every orchestrator. |
| Soft-dep capability probing (`pi.getAllTools()`) | `presentation/soft-dep.ts` | -- | Pure capability check; consumed by orchestrators that stage agents/MCP. |
| Marketplace list rendering (one line per marketplace) | `presentation` (Phase 4 ships first version) | -- | No IO beyond reading state already loaded by orchestrator. |
| User-visible notification | `shared/notify.ts` (sole `ctx.ui.notify` site) | every orchestrator | IL-2 / D-07: single audit surface. |
| Path containment check | `shared/path-safety.ts::assertPathInside` | every staging-dir computation | Single chokepoint per Phase 1 D-15. |
| Cleanup-with-leak-tracking | `shared/fs-utils.cleanupStaging` + `shared/errors.appendLeakToError` | every cleanup site | One consistent surface across Phase 3 + Phase 4. |
| Cross-scope name resolution | `orchestrators/marketplace/shared.ts::resolveScopeFromState` | -- | Pure state read; cross-scope ambiguity → throw `MarketplaceNotFoundError` (or duplicate-scope variant). |
| Autoupdate flag flip + idempotency reporting | `orchestrators/marketplace/autoupdate.ts` (consumes `applyAutoupdateFlip` from `shared.ts`) | -- | Pure state mutation; no IO beyond state-guard. |

______________________________________________________________________

## Standard Stack

### Core (already pinned at project level)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-git` | `^1.37.6` (verified `npm view isomorphic-git version` → `1.37.6` on 2026-05-10) [VERIFIED: npm registry] | git clone/fetch/checkout/resolveRef/writeRef | Drops V1's `execFile("git", ...)` shell-out; eliminates MA-7 "git not found" failure mode (Phase 1 D-21). Pure-JS, no PATH dependency. |
| `write-file-atomic` | `^8.0.0` (verified `npm view write-file-atomic version` → `8.0.0`) [VERIFIED: npm registry] | Atomic JSON writes (state.json, mcp.json, agents-index.json) | Already in use via `shared/atomic-json.ts`; Phase 4 doesn't call it directly (`saveState` does). |
| `typebox` | `^1.1.38` (verified `1.1.38`) [VERIFIED: npm registry] | JSON schema validation | Already in use via `STATE_VALIDATOR` and `MARKETPLACE_VALIDATOR`. Phase 4 doesn't add new schemas. |
| `node:fs/promises` | bundled with Node ≥22 | `rename`, `rm`, `readdir`, `stat`/`lstat`, `mkdir`, `readFile` | Built-in. |
| `node:crypto.randomUUID` | bundled with Node ≥22 | UUID for `sources-staging/<uuid>/` | Phase 3 precedent (agents-staging UUIDs). |
| `node:path` / `node:os` / `node:url` | bundled with Node ≥22 | Path joins, home-dir resolution | Built-in. |
| `@mariozechner/pi-coding-agent` | `^0.73.1` (peerDep `>=0.70.6`) | `ExtensionContext.pi.getAllTools()` for soft-dep probing (RH-3, RH-4) | Already a project peer-dep. |

### Phase 1-3 Carry-Forward (every symbol verified to exist)

| Module | Exports Phase 4 Consumes | Source Path |
|--------|-------------------------|-------------|
| `platform/git.ts` | `clone`, `fetch`, `pull` (NOT used by Phase 4 per D-13), `checkout`, `resolveRef`, `listBranches`, `listRemotes` | Phase 1 D-18..20 |
| `shared/notify.ts` | `notifySuccess`, `notifyWarning`, `notifyError(ctx, msg, cause?)` | Phase 1 D-07 |
| `shared/markers.ts` | `RELOAD_HINT_PREFIX = "Run /reload to "`, `PI_SUBAGENTS_NOT_LOADED = "pi-subagents is not loaded; "`, `PI_MCP_ADAPTER_NOT_LOADED = "pi-mcp-adapter is not loaded; "` | Phase 1 D-08 |
| `shared/path-safety.ts` | `assertPathInside`, `PathContainmentError`, `SymlinkRefusedError` | Phase 1 D-14..17 |
| `shared/fs-utils.ts` | `cleanupStaging(dir, label) → Promise<string|undefined>`, `pathExists(p) → Promise<boolean>` | Phase 3 |
| `shared/errors.ts` | `errorMessage`, `appendLeakToError`, `appendLeaks` | Phase 1 |
| `shared/atomic-json.ts` | `atomicWriteJson` (Phase 4 doesn't call directly; `saveState` does) | Phase 1 D-03 |
| `shared/types.ts` | `Scope = "user" | "project"`, `SCOPES` | Phase 2 |
| `domain/source.ts` | `parsePluginSource`, `pathSource`, `githubSource`, `ParsedSource`, `PathSource`, `GitHubSource` | Phase 2 D-06 |
| `domain/manifest.ts` | `MARKETPLACE_VALIDATOR`, `MARKETPLACE_SCHEMA`, `MarketplaceManifest` | Phase 2 |
| `domain/name.ts` | `assertSafeName(name, label)` | Phase 2 |
| `persistence/locations.ts` | `ScopedLocations`, `locationsFor(scope, cwd)`; uses: `extensionRoot`, `stateJsonPath`, `sourcesDir`, `sourceCloneDir(name)`, `pluginDataDir(mp, plugin)`, `marketplaceDataDir(mp)`, `agentsDir`, `mcpJsonPath` | Phase 2 |
| `persistence/state-io.ts` | `STATE_SCHEMA`, `STATE_VALIDATOR`, `DEFAULT_STATE`, `loadState`, `saveState`, `ExtensionState` | Phase 2 |
| `transaction/with-state-guard.ts` | `withStateGuard(locations, mutate) → Promise<T>` | Phase 2 D-02 |
| `bridges/skills/index.ts` | `unstagePluginSkills(input: { locations, previousSkillNames }) → Promise<UnstageSkillsResult>` (where `result.removedNames: readonly string[]`) | Phase 3 |
| `bridges/commands/index.ts` | `unstagePluginCommands(input: { locations, previousCommandNames }) → Promise<UnstageCommandsResult>` (`result.removedNames: readonly string[]`) | Phase 3 |
| `bridges/agents/index.ts` | `unstagePluginAgents(input: { locations, marketplaceName, pluginName }) → Promise<UnstageAgentsResult>` (`result.removedNames`, `result.failed: UnstageAgentFailure[]`, `result.warnings`) | Phase 3 |
| `bridges/mcp/index.ts` | `unstageMcpServers(input: { locations, marketplaceName, pluginName }) → Promise<UnstageMcpResult>` (`result.removedNames`) | Phase 3 |

**Critical asymmetry:** skills/commands unstage take `previousNames` arrays (read from state.json's `state.marketplaces[mp].plugins[pl].resources.{skills,prompts}`); agents/MCP unstage work from `(marketplace, plugin)` tuples (because they have on-disk indices/markers that own the resource list). The cascade primitive must read state ONCE for the names list, then call all four unstage functions.

### New Files Produced by Phase 4

| File | Purpose | Imports |
|------|---------|---------|
| `orchestrators/types.ts` | `PluginUpdateFn`, `PluginUpdateOutcome` types | `shared/types` (Scope only) |
| `orchestrators/marketplace/shared.ts` | `GitOps` interface + default impl, `cascadeUnstagePlugin`, `resolveScopeFromState`, `applyAutoupdateFlip` | bridges/*, persistence/*, platform/git, shared/* |
| `orchestrators/marketplace/add.ts` | `addMarketplace(opts)` | shared, domain/source, domain/manifest, persistence/*, transaction, shared/* |
| `orchestrators/marketplace/remove.ts` | `removeMarketplace(opts)` | shared, persistence/*, transaction, shared/* |
| `orchestrators/marketplace/list.ts` | `listMarketplaces(opts)` | persistence/* (read-only) |
| `orchestrators/marketplace/update.ts` | `updateMarketplace(opts)`, `updateAllMarketplaces(opts)` | shared, orchestrators/types, domain/manifest, persistence/*, transaction, shared/* |
| `orchestrators/marketplace/autoupdate.ts` | `setMarketplaceAutoupdate(opts)` | shared (`applyAutoupdateFlip`), persistence/*, transaction, shared/* |
| `presentation/reload-hint.ts` | `reloadHint(verb, names) → string`, `appendReloadHint(body, hint) → string` | shared/markers |
| `presentation/soft-dep.ts` | `hasLoadedPiSubagents(ctx)`, `hasLoadedPiMcpAdapter(ctx)` (or unified `softDepStatus(ctx)`) | `@mariozechner/pi-coding-agent` |
| `persistence/locations.ts` (extension) | New helpers `sourcesStagingDir(loc, uuid)` and (optional) `sourcesFinalDir(loc, marketplaceName)` -- the latter aliases the existing `sourceCloneDir(mp)` method, which is sufficient | -- |
| `shared/errors.ts` (extension) | New error classes: `MarketplaceUpdateError`, `StaleSourceCloneError`, `MarketplaceNotFoundError`, `MarketplaceDuplicateNameError` | -- |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled try/catch cascade | `runPhases` ledger from Phase 2 | **Rejected by D-02:** ledger halts on first throw; MR-3 needs continuation across plugin failures. Ledger could be re-introduced internally if Phase 5's plugin uninstall ever needs cross-bridge rollback within a single plugin -- locally swappable. |
| `gitOps.pull` (V1 + isomorphic-git surface) | `gitOps.fetch` + `gitOps.forceUpdateRef` + `gitOps.checkout` | **Rejected by D-13/D-14:** `pull` couples fetch to merge semantics; D-14's "follow upstream blindly" requires a force-overwrite path that `pull --ff-only` cannot express. Three explicit ops are 5 LOC more for unambiguous semantics. |
| Centralize ALL list rendering in Phase 6 `presentation/marketplace-list.ts` | Ship a minimal renderer in Phase 4's `list.ts` | The user constraint says Phase 4 ships `list` end-to-end. Ship the simple flat-list renderer in Phase 4 (one line per marketplace, no manifest reads); Phase 6's edge layer can later reuse the same module. (Phase 5's nested-tree renderer is a separate concern and lives in Phase 5/6.) |
| Eager state-load before guard for MA-8 duplicate check | Read state INSIDE the guard | The guard wraps the entire flow, so the duplicate check runs against fresh state with no extra IO. V1's preflight `loadState` was redundant. Drop it. |
| `instanceof git.Errors.MergeNotSupportedError` introspection | Wrap any error as `MarketplaceUpdateError` with cause | **Already locked by D-14**: under follow-upstream-blindly the resolution is the same for any failure mode -- one user-visible error class. |

### Installation

No new npm dependencies. Phase 4 reuses the project's existing dep set:

```bash
# Already present in package.json -- no change required.
# isomorphic-git@^1.37.6, write-file-atomic@^8.0.0, typebox@^1.1.38
```

**Version verification (2026-05-10 via `npm view`):** isomorphic-git 1.37.6, write-file-atomic 8.0.0, typebox 1.1.38. All current; no upgrade needed for Phase 4.

______________________________________________________________________

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─ pi runtime (Phase 7 index.ts) ──────────────────────┐
                       │     wires injection: GitOps default = platform/git;  │
                       │     PluginUpdateFn default = Phase 5 plugin/update   │
                       └────────────┬───────────────────┬─────────────────────┘
                                    │                   │
                                    │ (Phase 6)         │ (Phase 6)
                            edge/router.ts ─── parses args, picks scope
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       add(ctx, args, deps)  remove(ctx, args)     list(ctx, args)
                                    ▼                     ▼
                            update(ctx, args, deps) autoupdate(ctx, args)
                                    │                     │
                                    ▼                     ▼
                            ┌── orchestrators/marketplace/shared.ts ────────┐
                            │  GitOps interface + default | cascadeUnstage  │
                            │  resolveScopeFromState      | applyAutoupdate │
                            └────────────────────────────┬──────────────────┘
                                                         │
              ┌──────────────────────┬───────────────────┼─────────────────────┐
              ▼                      ▼                   ▼                     ▼
         platform/git           transaction/        persistence/           bridges/{skills,
       clone/fetch/checkout    withStateGuard        loadState           commands,agents,mcp}/
       resolveRef/writeRef    (load+mutate+save)   saveState/locations          unstage*
                                                         │
                                                         ▼
                                                   state.json + mcp.json + agents-index.json
                                                   (atomic via write-file-atomic)
                                                         ▲
                                                         │
                                                ┌────────┴────────┐
                                                ▼                 ▼
                                       presentation/        presentation/
                                       reload-hint.ts       soft-dep.ts
                                       (verb + names)       (pi.getAllTools)
                                                ▼
                                       shared/notify.ts
                                       (notifySuccess /
                                        notifyWarning /
                                        notifyError)
                                                │
                                                ▼
                                       ctx.ui.notify(...)  ← user
```

**Data flow for each subcommand:**

- **`add`:** parse source kind → resolve target locations → `withStateGuard` { check duplicate → if github: pre-clone stale check → `gitOps.clone(stagingDir)` → `MARKETPLACE_VALIDATOR.Check(manifest)` → `fs.rename(stagingDir, finalDir)` → mutate state → save } → `notifySuccess("Added marketplace ...")`
- **`remove`:** `resolveScopeFromState(name)` → `withStateGuard` { for each plugin in record: `cascadeUnstagePlugin(...)`; remove cleaned plugins from record; if `failedPlugins.length === 0` delete record entirely; save } → post-state cleanup (data dirs + clone dir if no failures) → emit success+reload-hint OR aggregated warning
- **`list`:** read state (no guard) for each scope → render flat list → `notifySuccess(body)` (or `No marketplaces configured.`)
- **`update`:** `withStateGuard` { if github: cloneAdvanced = `gitOps.fetch + forceUpdateRef + checkout` -- D-14 sequence ; manifest = `MARKETPLACE_VALIDATOR.Check(read finalDir/.claude-plugin/marketplace.json)` ; mutate `manifestPath`/`marketplaceRoot`/`lastUpdatedAt` ; save } → if `record.autoupdate === true`: cascade fan-out via `pluginUpdate(plugin, marketplace, scope)` for each `state.marketplaces[mp].plugins` key → emit reload hint with verb=`refresh` + soft-dep warnings if `updated[]` non-empty
- **`autoupdate`/`noautoupdate`:** `withStateGuard` { `applyAutoupdateFlip(state, name?, enable) → { changed, unchanged }` ; save } → render `Enabled autoupdate: ...` / `Already enabled: ...` lines

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── orchestrators/
│   ├── index.ts                # barrel; re-exports per-subcommand orchestrators
│   ├── types.ts                # NEW: PluginUpdateFn + PluginUpdateOutcome
│   └── marketplace/
│       ├── add.ts              # NEW: addMarketplace
│       ├── remove.ts           # NEW: removeMarketplace
│       ├── list.ts             # NEW: listMarketplaces
│       ├── update.ts           # NEW: updateMarketplace + updateAllMarketplaces
│       ├── autoupdate.ts       # NEW: setMarketplaceAutoupdate(name?, enable)
│       └── shared.ts           # NEW: GitOps, cascadeUnstagePlugin, resolveScopeFromState, applyAutoupdateFlip
├── presentation/
│   ├── index.ts                # extend barrel
│   ├── reload-hint.ts          # NEW
│   ├── soft-dep.ts             # NEW
│   └── marketplace-list.ts     # NEW (or rolled into list.ts; see Pattern 5)
├── persistence/
│   └── locations.ts            # EXTEND: sourcesStagingDir(loc, uuid)
└── shared/
    └── errors.ts               # EXTEND: MarketplaceUpdateError, StaleSourceCloneError, MarketplaceNotFoundError, MarketplaceDuplicateNameError
```

### Pattern 1: GitOps Interface + Function-Injection (D-12, D-13)

```typescript
// orchestrators/marketplace/shared.ts

import * as defaultGit from "../../platform/git.ts";

export interface GitOps {
  /** MA-5: clone url into dir, optional ref, single-branch when ref is set. */
  clone(opts: { dir: string; url: string; ref?: string; singleBranch?: boolean }): Promise<void>;
  /** D-14 step 1: refresh remote refs. */
  fetch(opts: { dir: string; remote?: string; ref?: string }): Promise<void>;
  /** D-14 step 2 (symbolic HEAD): set local branch ref to remote SHA. */
  forceUpdateRef(opts: { dir: string; ref: string; value: string }): Promise<void>;
  /** D-14 step 3: move HEAD to ref/SHA. */
  checkout(opts: { dir: string; ref: string }): Promise<void>;
  /** Resolve a ref name to its SHA -- used to read remote SHA after fetch. */
  resolveRef(opts: { dir: string; ref: string }): Promise<string>;
}

/** Default implementation: thin wrapper around platform/git.ts. */
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: async (o) => { await defaultGit.fetch(o); },
  forceUpdateRef: async ({ dir, ref, value }) => {
    // isomorphic-git writeRef with force:true sets a local ref to a SHA.
    // Source: node_modules/isomorphic-git/index.d.ts → writeRef({ fs, dir, ref, value, force, symbolic? })
    const git = await import("isomorphic-git");
    const fs = await import("node:fs");
    await git.writeRef({ fs: fs.default, dir, ref, value, force: true });
  },
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
};
```

**Why function-injection over module-level monkey-patching:** ESM frozen exports prevent test reassignment. Each orchestrator accepts `gitOps?: GitOps` parameter; production callers omit (default applies); tests pass `makeMockGitOps(state)` from `tests/helpers/git-mock.ts`.

### Pattern 2: Cascade Primitive (D-02, D-03)

```typescript
// orchestrators/marketplace/shared.ts

export interface UnstageOutcome {
  /** True when all 4 bridges' unstage* calls returned cleanly. */
  ok: boolean;
  /** Names that were actually removed across all 4 bridges. Empty when nothing was staged. */
  dropped: {
    skills: readonly string[];
    commands: readonly string[];
    agents: readonly string[];
    mcpServers: readonly string[];
  };
  /** Set on failure: chained Error.cause stack from the FIRST throw (D-03 fail-fast per plugin). */
  cause?: Error;
  /** AG-5 foreign-content rows: failed agents that retain index entries. Surface as part of cause when present. */
  failedAgents?: ReadonlyArray<{ generatedName: string; reason: string }>;
}

export async function cascadeUnstagePlugin(
  plugin: string,
  marketplace: string,
  locations: ScopedLocations,
  installedPlugin: PluginInstallRecord, // read from state inside the outer guard
): Promise<UnstageOutcome> {
  const dropped = { skills: [] as string[], commands: [] as string[], agents: [] as string[], mcpServers: [] as string[] };

  try {
    // PRD §5.2.2 PU-1 order: skills/prompts → agents → MCP servers.
    const skillsResult = await unstagePluginSkills({
      locations,
      previousSkillNames: installedPlugin.resources.skills,
    });
    dropped.skills = [...skillsResult.removedNames];

    const cmdResult = await unstagePluginCommands({
      locations,
      previousCommandNames: installedPlugin.resources.prompts,
    });
    dropped.commands = [...cmdResult.removedNames];

    const agentsResult = await unstagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.agents = [...agentsResult.removedNames];

    if (agentsResult.failed.length > 0) {
      // AG-5 foreign content: index rows preserved by the bridge; surface as plugin failure.
      const reasons = agentsResult.failed
        .map((f) => `${f.generatedName}: ${f.reason}`)
        .join("; ");
      throw new Error(
        `Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`,
      );
    }

    const mcpResult = await unstageMcpServers({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.mcpServers = [...mcpResult.removedNames];

    return { ok: true, dropped };
  } catch (err) {
    return {
      ok: false,
      dropped,
      cause: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
```

**Per-plugin caller (in `remove.ts`):**

```typescript
const failedPlugins: { name: string; cause: Error }[] = [];
const cleanedPluginNames: string[] = [];
const dropped = { skills: [], commands: [], agents: [], mcpServers: [] };

for (const [pluginName, plugin] of Object.entries(record.plugins)) {
  const outcome = await cascadeUnstagePlugin(pluginName, marketplaceName, locations, plugin);
  if (outcome.ok) {
    cleanedPluginNames.push(pluginName);
    if (outcome.dropped.skills.length || outcome.dropped.commands.length ||
        outcome.dropped.agents.length || outcome.dropped.mcpServers.length) {
      removedPlugins.push(pluginName);
    }
  } else {
    failedPlugins.push({ name: pluginName, cause: outcome.cause! });
  }
}
```

### Pattern 3: D-14 Follow-Upstream-Blindly Sequence (update.ts)

```typescript
async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
): Promise<{ cloneAdvanced: boolean }> {
  // Step 1: fetch (no merge implied, no working-tree changes).
  await gitOps.fetch({ dir: cloneDir, remote: "origin", ref: storedRef });

  if (storedRef === undefined) {
    // No pinned ref -- track remote default branch.
    const remoteSha = await gitOps.resolveRef({ dir: cloneDir, ref: "refs/remotes/origin/HEAD" });
    // For symbolic HEAD (branch ref), update local branch to remote SHA, then checkout.
    const currentBranch = await gitOps.resolveRef({ dir: cloneDir, ref: "HEAD" });
    // (Detect symbolic vs detached via isHeadDetached helper; if symbolic, force-update local branch ref.)
    // Implementation detail: when we cloned with no ref, we have a default branch checked out.
    await gitOps.forceUpdateRef({ dir: cloneDir, ref: currentBranch, value: remoteSha });
    await gitOps.checkout({ dir: cloneDir, ref: currentBranch });
    return { cloneAdvanced: true };
  }

  // Stored ref present. Two sub-cases:
  //   (a) ref is a branch name on origin -> symbolic HEAD path
  //   (b) ref is a tag or SHA -> detached HEAD path
  // We probe by trying to resolve refs/remotes/origin/<ref>. If that succeeds it's a branch; otherwise it's a tag/SHA.
  let remoteSha: string | undefined;
  try {
    remoteSha = await gitOps.resolveRef({ dir: cloneDir, ref: `refs/remotes/origin/${storedRef}` });
  } catch {
    remoteSha = undefined;
  }

  if (remoteSha !== undefined) {
    // Symbolic HEAD: force-update local branch ref to remote SHA, then checkout.
    await gitOps.forceUpdateRef({ dir: cloneDir, ref: `refs/heads/${storedRef}`, value: remoteSha });
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  } else {
    // Detached HEAD: checkout the SHA/tag directly.
    // If the SHA no longer exists (rewritten history), checkout throws -> caller wraps as MarketplaceUpdateError.
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  }

  return { cloneAdvanced: true };
}
```

**Why this composition:** isomorphic-git's `writeRef({ ref, value, force: true })` is the public API for setting a local ref to a SHA (verified in `node_modules/isomorphic-git/index.d.ts:695`). The default `pull` operation is `fetch + merge` and would ALWAYS attempt to fast-forward; D-14 explicitly avoids that semantic. `force: true` on `writeRef` is the documented way to overwrite a non-fast-forward local ref.

### Pattern 4: Reload-Hint Composition (RH-1 through RH-5)

```typescript
// presentation/reload-hint.ts

import { RELOAD_HINT_PREFIX } from "../shared/markers.ts";

export type ReloadVerb = "load" | "refresh" | "drop";

/**
 * Render the reload hint. Returns "" when names is empty (RH-1: no hint when no resources changed).
 * Format (RH-2):
 *   - 0 names: "" (no hint)
 *   - 1 name:  "Run /reload to <verb> it."
 *   - N names: 'Run /reload to <verb> "n1", "n2".'
 */
export function reloadHint(verb: ReloadVerb, names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${RELOAD_HINT_PREFIX}${verb} it.`;
  return `${RELOAD_HINT_PREFIX}${verb} ${names.map((n) => `"${n}"`).join(", ")}.`;
}

/** Append the hint to a body on its own trailing line. Returns the bare body when hint === "". */
export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

```typescript
// presentation/soft-dep.ts

import { PI_SUBAGENTS_NOT_LOADED, PI_MCP_ADAPTER_NOT_LOADED } from "../shared/markers.ts";

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export function hasLoadedPiSubagents(ctx: ExtensionContext): boolean {
  try {
    return ctx.pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    // pi.getAllTools() throws -> assume unloaded; warning is harmless when wrong.
    return false;
  }
}

export function hasLoadedPiMcpAdapter(ctx: ExtensionContext): boolean {
  try {
    return ctx.pi.getAllTools().some(
      (tool) => tool.name === "mcp" || tool.sourceInfo.source.includes("pi-mcp-adapter"),
    );
  } catch {
    return false;
  }
}

/** Compose the canonical RH-5 warning line. Empty string when probe says loaded or no resources of that kind exist. */
export function subagentWarningIfNeeded(ctx: ExtensionContext, agentsStaged: readonly string[]): string {
  if (agentsStaged.length === 0 || hasLoadedPiSubagents(ctx)) return "";
  return `${PI_SUBAGENTS_NOT_LOADED}install/load it (e.g. via /pi:packages add npm:pi-subagents) and run /reload.`;
}

export function mcpAdapterWarningIfNeeded(ctx: ExtensionContext, mcpStaged: readonly string[]): string {
  if (mcpStaged.length === 0 || hasLoadedPiMcpAdapter(ctx)) return "";
  return `${PI_MCP_ADAPTER_NOT_LOADED}install/load it (e.g. via /pi:packages add npm:pi-mcp-adapter) and run /reload.`;
}
```

**RH-5 ordering:** Body → soft-dep warnings → reload hint. Final wire format example for `marketplace remove`:

```
Removed marketplace "official" in user scope. Dropped plugins: hello, world.
pi-subagents is not loaded; install/load it ... and run /reload.
Run /reload to drop "hello", "world".
```

### Pattern 5: List Renderer (ML-1..4)

For Phase 4, ship a flat-list renderer in `presentation/marketplace-list.ts` (or inline in `list.ts` if ≤30 LOC):

```typescript
import type { MarketplaceRecord } from "../persistence/state-io.ts";

const ICON = "●";

export function renderMarketplaceList(records: MarketplaceRecord[]): string {
  if (records.length === 0) return "No marketplaces configured.";

  const byScope: Record<"user" | "project", MarketplaceRecord[]> = { user: [], project: [] };
  for (const m of records) byScope[m.scope].push(m);

  const lines: string[] = [];
  for (const scope of ["user", "project"] as const) {
    const entries = byScope[scope];
    if (entries.length === 0) continue;
    if (lines.length > 0) lines.push("");
    lines.push(`${scope} scope marketplaces:`);
    for (const m of entries) {
      const auto = m.autoupdate === true ? " [autoupdate]" : "";
      const logical = "logical" in m.source ? m.source.logical : m.source.raw; // PathSource has logical; GitHubSource has raw
      lines.push(`  ${ICON} ${m.name} (${logical})${auto}`);
    }
  }

  return lines.join("\n");
}
```

**Note on `source.logical`:** `PathSource` has `logical` (currently equal to `raw`); `GitHubSource` does not -- it has `raw`. Use `raw` for both to match V1 behavior, or extend types per the V1 reference (which used `source.logical` uniformly via a getter). **Plan task: confirm `source.logical` access pattern from `domain/source.ts`** -- the current `domain/source.ts:25` only declares `logical` on `PathSource`, so the renderer must branch on `kind`.

### Pattern 6: Scope Resolution (MR-1, MU-1, MAU-1)

```typescript
// orchestrators/marketplace/shared.ts

export class MarketplaceNotFoundError extends Error {
  readonly mpName: string;
  readonly scopes: readonly Scope[];
  constructor(mpName: string, scopes: readonly Scope[], detail = "") {
    super(`Marketplace "${mpName}" not found in ${scopes.join(", ")} scope${scopes.length > 1 ? "s" : ""}.${detail ? " " + detail : ""}`);
    this.name = "MarketplaceNotFoundError";
    this.mpName = mpName;
    this.scopes = scopes;
  }
}

export class MarketplaceAmbiguousScopeError extends Error {
  constructor(mpName: string) {
    super(`Marketplace "${mpName}" exists in both user and project scopes. Use --scope user or --scope project to disambiguate.`);
    this.name = "MarketplaceAmbiguousScopeError";
  }
}

export async function resolveScopeFromState(
  mpName: string,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations }> {
  const [userState, projectState] = await Promise.all([
    loadState(userLocations.extensionRoot),
    loadState(projectLocations.extensionRoot),
  ]);
  const inUser = mpName in userState.marketplaces;
  const inProject = mpName in projectState.marketplaces;
  if (inUser && inProject) throw new MarketplaceAmbiguousScopeError(mpName);
  if (inUser) return { scope: "user", locations: userLocations };
  if (inProject) return { scope: "project", locations: projectLocations };
  throw new MarketplaceNotFoundError(mpName, ["user", "project"]);
}
```

### Pattern 7: `applyAutoupdateFlip` (MAU-1..4)

Mirror V1's `setMarketplaceAutoupdate` shape (verified in V1 reference at `marketplace/autoupdate.ts`). Single helper used by `autoupdate.ts` for the flip itself and by `update.ts` IF the cascade ever needs to reset the flag (deferred -- not Phase 4). Lifted into `shared.ts` per D-01.

```typescript
export interface AutoupdateFlipResult {
  changed: string[];
  unchanged: string[];
}

export function applyAutoupdateFlip(
  state: ExtensionState,
  name: string | undefined, // undefined = "all in this scope"
  enable: boolean,
): AutoupdateFlipResult {
  const result: AutoupdateFlipResult = { changed: [], unchanged: [] };
  if (name !== undefined) {
    const record = state.marketplaces[name];
    if (record === undefined) {
      throw new MarketplaceNotFoundError(name, []); // caller fills scope detail
    }
    if ((record.autoupdate ?? false) === enable) {
      result.unchanged.push(name);
    } else {
      record.autoupdate = enable;
      result.changed.push(name);
    }
    return result;
  }
  for (const [mp, record] of Object.entries(state.marketplaces)) {
    if ((record.autoupdate ?? false) === enable) {
      result.unchanged.push(mp);
    } else {
      record.autoupdate = enable;
      result.changed.push(mp);
    }
  }
  return result;
}
```

### Anti-Patterns to Avoid

- **Don't load state outside `withStateGuard` for mutating orchestrators.** Phase 2 D-04 outer-guard pattern means the guard's `loadState` is the canonical fresh read; a preflight `loadState` only opens a TOCTOU window between the preflight and the guard's read.
- **Don't import `runPhases` from `transaction/`** in any Phase 4 file -- D-02 explicitly forbids its use. The cascade is shaped wrong for the ledger semantics. ESLint won't catch this; code review must.
- **Don't inline `Run /reload to ...` strings.** Compose via `presentation/reload-hint.ts::reloadHint(verb, names)`. ES-5 stable strings live in `shared/markers.ts`; orchestrators NEVER inline them.
- **Don't use `git.pull` from `platform/git.ts`** in Phase 4. D-13 drops `pull` from the Phase 4 `GitOps` surface. The `pull` export remains in `platform/git.ts` for Phase 5 (which may consume it for plugin update sync) -- but only `fetch + forceUpdateRef + checkout` for marketplace update.
- **Don't compose multi-line success messages by hand-concatenating `\n`.** Use a helper that joins parts and runs through `appendReloadHint`. The PRD §6.12 ES-5 marker tests at `tests/architecture/markers-snapshot.test.ts` will fail loudly on any divergence.
- **Don't call `notifyError` from inside the cascade loop** -- MR-4 mandates ONE aggregated `warning` notification at the end. Per-plugin `notifyError` calls multiply the user-visible noise.
- **Don't write to `<scopeRoot>/sources-staging/`** -- it must be `<scopeRoot>/pi-claude-marketplace/sources-staging/` (D-09). The `extensionRoot` already includes the `pi-claude-marketplace/` segment; pass through `assertPathInside(extensionRoot, candidate)`.

______________________________________________________________________

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic JSON write | tmp + rename + fsync | `shared/atomic-json.ts::atomicWriteJson` (used internally by `saveState`) | Phase 1 D-03; fsync semantics, concurrent-write queue, signal-cleanup. |
| Recursive staging cleanup with leak tracking | hand-rolled `try { rm } catch { ... }` | `shared/fs-utils.cleanupStaging(dir, label)` + `shared/errors.appendLeakToError` | Phase 3; ENOENT-tolerant, returns leak descriptor instead of throwing, single audit surface. |
| `Run /reload to ...` formatting | inline string literal | `presentation/reload-hint.ts::reloadHint(verb, names)` + `RELOAD_HINT_PREFIX` from `shared/markers.ts` | ES-5 stable contract; the markers-snapshot test enforces byte equality with PRD §6.12. |
| `pi-subagents is not loaded; ...` warning | inline string literal | `presentation/soft-dep.ts::subagentWarningIfNeeded(ctx, agentsStaged)` + `PI_SUBAGENTS_NOT_LOADED` constant | Same ES-5 stable-contract reasoning. |
| Path containment checks | `path.relative + startsWith` | `shared/path-safety.ts::assertPathInside(parent, child, label)` | Phase 1 D-15; symlink-refusing, single chokepoint. |
| Source kind detection | regex on raw string | `domain/source.ts::parsePluginSource(raw)` returning discriminated union | Phase 2 D-06; ST-6 funnel guarantees. |
| Marketplace.json validation | hand-rolled property checks | `domain/manifest.ts::MARKETPLACE_VALIDATOR.Check(value)` (TypeBox JIT) | Phase 2; same validator used at parse-time + state-load. |
| `state.json` load with migration + revalidation | manual JSON.parse + property checks | `persistence/state-io.ts::loadState(extensionRoot)` | Phase 2; ST-4/ST-5 legacy migration + ST-6 source revalidation built-in. |
| Concurrent-mutation detection | manual readback + diff | `transaction/with-state-guard.ts::withStateGuard(loc, mutate)` | Phase 2 D-02; load-fresh-then-save-on-no-throw discipline. |
| UUID for staging dirs | timestamp + counter | `crypto.randomUUID()` | Phase 3 precedent; collision-free across processes. |
| Force-update local git ref to a SHA | manually open `.git/refs/heads/<branch>` and write the SHA | `git.writeRef({ fs, dir, ref, value, force: true })` from isomorphic-git | Verified in `node_modules/isomorphic-git/index.d.ts:695-704`; handles packed-refs, lockfile semantics, and platform-specific concerns. |
| Notify with severity wrappers | direct `ctx.ui.notify(msg, "warning")` | `shared/notify.ts::notifyWarning(ctx, msg)` etc. | Phase 1 D-07; severity in name eliminates magic-string typo class (e.g. `"warining"` → silent degrade to info). |

**Key insight:** Phase 1-3 deliberately built the foundation Phase 4 needs. Every problem the marketplace orchestrators encounter has a canonical helper. The orchestrators themselves are 90% composition + 10% per-subcommand state-mutation logic. The non-trivial new code is the cascade primitive (Pattern 2) and the D-14 fetch+forceUpdateRef+checkout sequence (Pattern 3); everything else delegates.

______________________________________________________________________

## Common Pitfalls

### Pitfall 1: TOCTOU between MA-6 stale-clone check and atomic rename

**What goes wrong:** A naïve implementation reads `pathExists(finalDir)` outside the state guard, then clones, then renames. Between the existence check and the rename, another process can create `finalDir` -- the rename then either silently overwrites (if `finalDir` was empty) or fails opaquely.

**Why it happens:** `fs.rename` over an existing empty directory succeeds on POSIX, silently clobbering. The window between check and rename is wide because the clone (network) sits inside it.

**How to avoid:** D-04 wraps both the check and the clone+rename inside `withStateGuard`. The guard doesn't lock the filesystem, but the same-process MA-8 check (state has duplicate name) closes the most common race; for cross-process races the secondary `pathExists(finalDir)` IMMEDIATELY before `fs.rename` is the correct mitigation. V1 uses this two-step preflight; preserve it.

**Warning signs:** Tests pass single-threaded but a stress test with two concurrent `marketplace add` of the same name produces both "stale source clone" AND "duplicate name" errors non-deterministically. Either is correct; the bug is silent overwrite.

### Pitfall 2: `EXDEV` cross-FS rename for staging

**What goes wrong:** If staging dir and final dir are on different filesystems (or different APFS volumes that look like one disk), `fs.rename` returns `EXDEV`. NFR-1 requires atomicity; falling back to `copyFile + unlink` silently downgrades.

**Why it happens:** APFS firmlinks, Docker bind-mounts, or `/tmp` being tmpfs.

**How to avoid:** D-09 staging at `<scopeRoot>/pi-claude-marketplace/sources-staging/<uuid>/` is sibling-of-target by construction. Both dirs are under `extensionRoot`, so they share a filesystem regardless of how scope roots are mounted. Do NOT add an EXDEV fallback -- treat it as a misconfiguration error. Document the residual hazard if `extensionRoot` is itself a mountpoint on top of two filesystems (rare, but possible with bind mounts).

**Warning signs:** Pitfall #1 of `.planning/research/PITFALLS.md` documents this. Tests that mount different parts of the test tmp dir on different volumes will catch it.

### Pitfall 3: `pi.getAllTools()` throws (Pi process startup race)

**What goes wrong:** Soft-dep probing depends on `pi.getAllTools()` returning a list. In a degraded Pi state (registry not yet loaded), it could throw or return an empty array. The probe then returns false, and the warning fires when it shouldn't (or vice versa).

**Why it happens:** Pi extensions are loaded asynchronously; the `getAllTools` registry might not be fully populated at the moment a marketplace command runs.

**How to avoid:** Wrap each probe in try/catch (Pattern 4 example shows this). On throw, return `false` -- the worst case is a spurious warning. The user experience degrades gracefully: a warning that says "pi-subagents is not loaded" when it actually is is annoying but not blocking; the inverse (warning suppressed when needed) is worse but the probe contract is best-effort capability detection (PRD §6.8).

**Warning signs:** Integration tests pass but a Pi-host integration with mocked-empty `getAllTools` triggers spurious warnings. Real-world reports of warnings appearing and disappearing.

### Pitfall 4: Cascade loop reads stale resource lists from `record` snapshot

**What goes wrong:** `marketplace remove` reads `state.marketplaces[name]` once (preflight or inside guard); cascades over `record.plugins`. Between the read and the per-plugin unstage call, the resource list could be stale if a concurrent process modifies state. The bridges' unstage functions take `previousNames` arrays directly -- if those names are stale (e.g., a partially-installed plugin's resources weren't all recorded), unstage misses them. Result: orphaned files.

**Why it happens:** Bridges' unstage signatures are state-driven for skills/commands but tuple-driven for agents/MCP. The cascade primitive must read state ONCE inside the guard.

**How to avoid:** Cascade primitive accepts the `installedPlugin: PluginInstallRecord` (read inside the outer guard from fresh state). All four bridge calls happen sequentially inside the same guard window. Concurrent state changes between guards are detected by the next process's guard load -- accept the residual cross-process race per Phase 2 documentation.

**Warning signs:** Concurrent `marketplace remove` and `plugin install` of the same plugin produces one of: orphaned skill dir, orphaned command file, AG-5 foreign-content false positive, MC-7 noop on file that should have content. Test with two-process simulation.

### Pitfall 5: Marker-string drift in reload hint (ES-5)

**What goes wrong:** `Run /reload to <verb> "n1", "n2".` is gitlint-grade stable text. A refactor that changes the format ("Run `/reload` to ..." with backticks, or different quote style) silently breaks the user contract. The PRD §6.12 ES-5 markers-snapshot test guards against literal change in `shared/markers.ts`, but `presentation/reload-hint.ts` composes around the constant and can still drift on the variable parts.

**Why it happens:** ES-5 only locks the prefix `Run /reload to `; the verb + names tail is composed in code.

**How to avoid:** Snapshot test at `tests/presentation/reload-hint.test.ts` asserts byte-equality against PRD examples (RH-2). Tests use the existing `tests/helpers/prd-extract.ts` pattern -- extend it to extract the RH-2 row examples or hard-code them with a comment citing PRD line numbers.

**Warning signs:** Code review changes that add formatting helpers (markdown bold, Pi-specific styling) inside `reload-hint.ts`. Run the snapshot test in CI on every PR.

### Pitfall 6: `gitOps.checkout` ambiguity between branch and SHA

**What goes wrong:** isomorphic-git's `checkout({ ref })` accepts both branch names and SHAs. If `ref` is a branch name that doesn't exist locally but does exist as `refs/remotes/origin/<ref>`, behavior depends on flags. After D-14's `forceUpdateRef`, the local branch ref is set; `checkout(ref)` should then succeed by branch-name DWIM. But if the local branch ref doesn't exist (e.g., we're tracking a tag), `checkout` might silently land on a remote-tracking ref instead.

**Why it happens:** isomorphic-git's `checkout` is implementation-defined for ambiguous refs.

**How to avoid:** Probe `refs/remotes/origin/<ref>` first (Pattern 3); branch into symbolic-HEAD vs detached-HEAD paths explicitly. The test harness MUST exercise both: a branch-tracking marketplace and a tag-tracking marketplace.

**Warning signs:** `marketplace update` succeeds for a tag-pinned marketplace but the working tree is at a different SHA than expected. Diagnose by checking `git rev-parse HEAD` post-update against the expected stored ref.

### Pitfall 7: Concurrent `marketplace update` against the same clone dir

**What goes wrong:** Two Pi processes both run `marketplace update <name>` against the same scope. Both call `gitOps.fetch` and then `gitOps.forceUpdateRef`+`gitOps.checkout` -- isomorphic-git uses local lockfiles in `.git/index.lock` etc., but two simultaneous `forceUpdateRef`+`checkout` cycles can race even with the lockfile (the cycle is not atomic at the working-tree level).

**Why it happens:** isomorphic-git's per-call lockfile doesn't span multiple calls.

**How to avoid:** D-04 wraps the entire flow in `withStateGuard`, which is intra-process only -- not cross-process. For cross-process safety, document in the orchestrator's docstring that concurrent `marketplace update` against the same scope is best-effort: each process completes its sequence; the last writer wins on `lastUpdatedAt`. The working tree will land on one of the two upstream SHAs; either is correct (D-14 says "follow upstream", and both processes saw the same upstream).

**Warning signs:** Race-condition reports with "weird checkout state". The MU-5 retry hint covers most user-visible cases.

### Pitfall 8: AG-5 foreign-content surfacing as plugin-level vs bridge-level failure

**What goes wrong:** `unstagePluginAgents` returns `result.failed[]` for AG-5 violations (foreign content); the bridge does NOT throw. If the cascade naïvely does `if (failed.length) throw`, the plugin lands in `failedPlugins[]` -- correct. If the cascade ignores `failed`, the plugin's record is dropped despite having undeleted files, and the user sees no diagnosis.

**Why it happens:** Bridge unstage is "soft-fail" by design (AG-5 contract); cascade must opt-in to the strict semantics.

**How to avoid:** Pattern 2 cascade primitive throws on `agentsResult.failed.length > 0` with a constructed error message naming the failed agents. The throw is caught by the per-plugin try/catch, lands the plugin in `failedPlugins[]`. MR-7's "GitHub clone dirs retained when any plugin failed" is then satisfied because the cleanup gate is `failedPlugins.length === 0`.

**Warning signs:** A cascade that drops the marketplace record despite the agents bridge having retained index entries. Test with a plugin that has hand-written agent files (no marker) under the agents-staged path.

### Pitfall 9: `state.marketplaces[mp]` deletion safety

**What goes wrong:** Direct `delete state.marketplaces[name]` works but `Object.keys` order is preserved -- subsequent code that iterates the marketplaces map sees a stable order. If iteration happens during cascade and another code path mutates the map mid-loop, behavior is undefined.

**Why it happens:** The state shape uses dynamic record indexing (`Type.Record(Type.String(), ...)`) without an explicit ordering invariant.

**How to avoid:** All mutations happen inside `withStateGuard`'s mutate closure. Iterate via `Object.entries(state.marketplaces)` BEFORE any deletion; build a list of names to delete; delete after the iteration. ESLint rule `@typescript-eslint/no-dynamic-delete` is allowed for this case but warrant a comment.

**Warning signs:** Tests pass single-marketplace; multi-marketplace bare-form `marketplace update` exhibits non-deterministic behavior.

### Pitfall 10: `notifyError` swallowing the `Error.cause` chain

**What goes wrong:** ES-4 mandates `Error.cause` chain through cascade reporting. `shared/notify.ts::notifyError(ctx, msg, cause?)` surfaces `cause.message` flat (one level deep). MR-3's per-plugin failures may have multi-level chained causes (bridge → cascade primitive → orchestrator). Showing only the outermost message hides the actionable diagnostic.

**Why it happens:** Phase 1 ships `notifyError` with one-level surfacing. Phase 6's `formatErrorWithCauses` (PRD §6.12 ES-4) is deferred.

**How to avoid:** For `marketplace remove`'s aggregated warning, build the body manually with `formatErrorWithCauses`-equivalent: walk `Error.cause` up to depth 5 and join with ` -- caused by: `. V1's reference at `marketplace/update.ts::formatErrorWithCauses` is the canonical implementation -- copy its 5-level bound. Phase 4 can ship a local copy in `shared.ts` (or `presentation/cascade.ts` if it grows), pending Phase 6's `formatErrorWithCauses` shared helper.

**Warning signs:** Aggregated `warning` notification shows top-level "removing recorded resources" without the underlying `Error.cause` chain (path containment, EACCES, etc.). User can't diagnose.

______________________________________________________________________

## Code Examples

### Example 1: `addMarketplace` happy path (GitHub source)

```typescript
// orchestrators/marketplace/add.ts (sketch)

import { randomUUID } from "node:crypto";
import { rename } from "node:fs/promises";
import path from "node:path";

import { MARKETPLACE_VALIDATOR } from "../../domain/manifest.ts";
import type { ParsedSource } from "../../domain/source.ts";
import { locationsFor, type ScopedLocations } from "../../persistence/locations.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { appendLeakToError } from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import { notifySuccess } from "../../shared/notify.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { sourcesStagingDir } from "../../persistence/locations.ts"; // NEW

import {
  DEFAULT_GIT_OPS,
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  type GitOps,
} from "./shared.ts";

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface AddMarketplaceOptions {
  ctx: ExtensionContext;
  locations: ScopedLocations;
  source: ParsedSource;
  gitOps?: GitOps;
}

export async function addMarketplace(opts: AddMarketplaceOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;

  await withStateGuard(opts.locations, async (state) => {
    if (opts.source.kind === "github") {
      await addGithub(opts, gitOps, state);
    } else if (opts.source.kind === "path") {
      await addPath(opts, state);
    } else {
      // 'unknown' source -- parsePluginSource already produced the reason; surface it (MA-10).
      throw new Error(opts.source.reason);
    }
  });

  notifySuccess(opts.ctx, `Added marketplace "${/* name */ ""}" in ${opts.locations.scope} scope.`);
  // (NO reload hint -- MA-11)
}

async function addGithub(
  opts: AddMarketplaceOptions,
  gitOps: GitOps,
  state: ExtensionState,
): Promise<void> {
  const { locations, source } = opts;
  if (source.kind !== "github") throw new Error("internal: addGithub called with non-github source");

  // 1. Compute staging + final dirs.
  const uuid = randomUUID();
  const stagingDir = await sourcesStagingDir(locations, uuid);
  const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git`;

  // 2. Clone into staging (NETWORK -- gated by NFR-5; only github branch reaches here).
  await gitOps.clone({
    dir: stagingDir,
    url: cloneUrl,
    ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
  });

  let stagingExists = true;
  let finalDir: string | null = null;
  try {
    // 3. Read manifest from staged clone, validate against schema.
    const manifestPath = path.join(stagingDir, ".claude-plugin", "marketplace.json");
    const text = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(text);
    if (!MARKETPLACE_VALIDATOR.Check(parsed)) throw new Error(/* validation detail */);
    const name = parsed.name;

    // 4. MA-8 duplicate name check (against fresh state -- inside the guard).
    if (name in state.marketplaces) throw new MarketplaceDuplicateNameError(name, locations.scope);

    // 5. MA-6 stale-clone refusal (against final dir).
    finalDir = await locations.sourceCloneDir(name);
    if (await pathExists(finalDir)) {
      // sourceCloneDir always returns a path; pathExists is true iff anything is there.
      throw new StaleSourceCloneError(finalDir);
    }

    // 6. Atomic rename: stagingDir -> finalDir. Same FS by construction (D-09).
    await rename(stagingDir, finalDir);
    stagingExists = false;

    // 7. Mutate state.
    state.marketplaces[name] = {
      name,
      scope: locations.scope,
      source,
      addedFromCwd: process.cwd(),
      manifestPath: path.join(finalDir, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: finalDir,
      lastUpdatedAt: new Date().toISOString(),
      plugins: {},
    };
    finalDir = null; // Successful state mutation -- clean-up pointer cleared.
  } catch (err) {
    // MA-9 cleanup path. Append leaks instead of mask.
    let wrapped = err;
    if (stagingExists) {
      const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
      wrapped = appendLeakToError(wrapped, leak);
    }
    if (finalDir !== null) {
      const leak = await cleanupStaging(finalDir, "marketplace final clone");
      wrapped = appendLeakToError(wrapped, leak);
    }
    throw wrapped;
  }
}
```

### Example 2: `cascadeUnstagePlugin` consumer (in `remove.ts`)

```typescript
// orchestrators/marketplace/remove.ts (sketch -- omitting imports)

const { dropped, failedPlugins, cleanedPluginNames } = await withStateGuard(
  locations,
  async (state) => {
    const record = state.marketplaces[name];
    if (record === undefined) throw new MarketplaceNotFoundError(name, [locations.scope]);

    const dropped = { skills: [], commands: [], agents: [], mcpServers: [] };
    const failedPlugins: { name: string; cause: Error }[] = [];
    const cleanedPluginNames: string[] = [];

    for (const [pluginName, plugin] of Object.entries(record.plugins)) {
      const outcome = await cascadeUnstagePlugin(pluginName, name, locations, plugin);
      if (outcome.ok) {
        cleanedPluginNames.push(pluginName);
        // Track aggregated dropped names for MR-8 reload-hint payload.
        dropped.skills.push(...outcome.dropped.skills);
        dropped.commands.push(...outcome.dropped.commands);
        dropped.agents.push(...outcome.dropped.agents);
        dropped.mcpServers.push(...outcome.dropped.mcpServers);
      } else {
        failedPlugins.push({ name: pluginName, cause: outcome.cause! });
      }
    }

    // Apply state mutations.
    for (const cleaned of cleanedPluginNames) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete record.plugins[cleaned];
    }
    if (failedPlugins.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete state.marketplaces[name];
    }
    return { dropped, failedPlugins, cleanedPluginNames };
  },
);

// Post-state cleanup (MR-5 / MR-6). AFTER the guard closes -- state already committed.
// ... (rm pluginDataDir for each cleaned plugin; if failedPlugins.length === 0, also rm marketplaceDataDir + sourceCloneDir)
```

______________________________________________________________________

## Runtime State Inventory

> Phase 4 is greenfield (no rename / refactor / migration). However, REQUIREMENTS.md edits are required by D-14 supersession.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- state.json shape unchanged. ST-2 already declares `autoupdate?: boolean` (verified `state-io.ts:71`) and `manifestPath`/`marketplaceRoot` (already required since Phase 2). | None. |
| Live service config | None -- no external services touched by Phase 4. | None. |
| OS-registered state | None -- no OS task / scheduler / launchd state. | None. |
| Secrets/env vars | None -- no env vars consumed. | None. |
| Build artifacts | None -- no compiled artifacts to refresh. | None. |
| Documentation supersession (D-14) | REQUIREMENTS.md MU-2 + MU-3 marked superseded; PROJECT.md Key Decisions row added. | Plan task: edit REQUIREMENTS.md to add strikethrough + supersession note for MU-2 and MU-3 mirroring the MA-7 / D-21 pattern. Edit PROJECT.md Key Decisions table to add the D-14 row. |

______________________________________________________________________

## Validation Architecture

> nyquist_validation is enabled per .planning/config.json.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥22) |
| Config file | none (relies on `node --test` glob in package.json `test` script) |
| Quick run command | `node --test "tests/orchestrators/marketplace/<file>.test.ts"` |
| Full suite command | `npm test` (or `npm run check`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MA-1 | Source kind dispatch (path/github) | unit | `node --test tests/orchestrators/marketplace/add.test.ts` | ❌ Wave 0 |
| MA-2/SC-5 | Default scope = user | unit (edge layer test, but verify orchestrator accepts scope) | same | ❌ Wave 0 |
| MA-3 | Local path: directory or `marketplace.json` direct | unit | same | ❌ Wave 0 |
| MA-4 | Tilde paths preserved verbatim | unit | already covered by `tests/domain/source.test.ts` | ✅ existing |
| MA-5 | Clone-then-rename via `gitOps.clone` mock | unit | `add.test.ts` with `makeMockGitOps` | ❌ Wave 0 |
| MA-6 | Stale clone refusal | unit | same | ❌ Wave 0 |
| MA-8 | Duplicate name in scope | unit | same | ❌ Wave 0 |
| MA-9 | Manifest read failure → cleanup → leak | unit | same | ❌ Wave 0 |
| MA-10 | SSH/arbitrary URL/`@ref`/browser-paste rejected | unit | already covered by `tests/domain/source.test.ts`; orchestrator delegates | ✅ existing for parser; ❌ for orchestrator dispatch |
| MA-11 | Success message + NO reload hint | unit | `add.test.ts` snapshot | ❌ Wave 0 |
| MR-1 | Cross-scope ambiguity → throw | unit | `tests/orchestrators/marketplace/remove.test.ts` | ❌ Wave 0 |
| MR-2/MR-3 | Per-plugin cascade aggregation with chained causes | unit | `tests/orchestrators/marketplace/cascade.test.ts` (separate file for cascade primitive) | ❌ Wave 0 |
| MR-4 | ONE aggregated warning notification | unit | `remove.test.ts` with mock `ctx.ui.notify` | ❌ Wave 0 |
| MR-5/MR-6/MR-7 | Post-state cleanup ordering + leak aggregation | unit | `remove.test.ts` | ❌ Wave 0 |
| MR-8 | Reload hint emitted only when ≥1 resource removed | unit | `remove.test.ts` | ❌ Wave 0 |
| ML-1..4 | List rendering by scope; empty case | unit | `tests/orchestrators/marketplace/list.test.ts` and `tests/presentation/marketplace-list.test.ts` | ❌ Wave 0 |
| MU-1 | Bare-form refresh + empty silent succeed | unit | `tests/orchestrators/marketplace/update.test.ts` | ❌ Wave 0 |
| MU-4 | Manifest persisted before cascade | unit | `update.test.ts` with mocked `pluginUpdate` that asserts state.json was saved before its first call | ❌ Wave 0 |
| MU-5 | Clone advanced + manifest save fails → "Retry the command." | unit | `update.test.ts` | ❌ Wave 0 |
| MU-6 | Cascade gated on `autoupdate` flag | unit | `update.test.ts` | ❌ Wave 0 |
| MU-7 | Partition rendering order (updated → unchanged → skipped → failed) | unit | `update.test.ts` with `PluginUpdateOutcome` mocks | ❌ Wave 0 |
| MU-8 | New manifest entries NOT auto-installed | unit | `update.test.ts` -- assert injected `pluginUpdate` was called once per pre-existing state plugin, never for new manifest-only plugins | ❌ Wave 0 |
| MU-9 | Reload hint + soft-dep warnings composition | unit | `update.test.ts` with mock `ctx.pi.getAllTools` | ❌ Wave 0 |
| MAU-1..4 | Single-name + bare-form flips, idempotency, missing/undefined → false | unit | `tests/orchestrators/marketplace/autoupdate.test.ts` | ❌ Wave 0 |
| RH-1/RH-2 | Reload hint format + empty-names suppression | unit | `tests/presentation/reload-hint.test.ts` (snapshot vs PRD §6.8) | ❌ Wave 0 |
| RH-3/RH-4 | Soft-dep probe matches | unit | `tests/presentation/soft-dep.test.ts` with mock `pi.getAllTools()` | ❌ Wave 0 |
| RH-5 | Soft-dep warning BEFORE trailing reload hint | integration | covered by `update.test.ts` and `remove.test.ts` end-to-end notifications | ❌ Wave 0 |
| SC-6 | Bare-form list/update/autoupdate enumerate both scopes | unit | per-orchestrator test passing both `userLocations` and `projectLocations` | ❌ Wave 0 |
| NFR-5 | Path-source `add`, `list`, `remove`, `autoupdate` MUST NOT touch network | unit | mock `GitOps` that asserts no method called for these flows; pass to orchestrator with assertion-on-call mock | ❌ Wave 0 |
| D-14 | Force-pushed remote → orchestrator follows; SHA-no-longer-exists → MarketplaceUpdateError | unit | `update.test.ts` with `makeMockGitOps` exercising both | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/orchestrators/marketplace/<file>.test.ts` (under 10 seconds for the orchestrator-level files)
- **Per wave merge:** `npm test` (full suite; ~441 existing tests + Phase 4 additions)
- **Phase gate:** `npm run check` green before `/gsd-verify-work` (typecheck + lint + format + tests)

### Wave 0 Gaps

- [ ] `tests/orchestrators/marketplace/add.test.ts` -- covers MA-1, MA-5, MA-6, MA-8, MA-9, MA-10, MA-11
- [ ] `tests/orchestrators/marketplace/remove.test.ts` -- covers MR-1..8
- [ ] `tests/orchestrators/marketplace/list.test.ts` -- covers ML-1..4
- [ ] `tests/orchestrators/marketplace/update.test.ts` -- covers MU-1, MU-4..9, D-14
- [ ] `tests/orchestrators/marketplace/autoupdate.test.ts` -- covers MAU-1..4
- [ ] `tests/orchestrators/marketplace/cascade.test.ts` -- covers `cascadeUnstagePlugin` primitive in isolation (the surface Phase 5 reuses)
- [ ] `tests/presentation/reload-hint.test.ts` -- covers RH-1, RH-2 (PRD-snapshot via `tests/helpers/prd-extract.ts` extended with RH-2 row literals)
- [ ] `tests/presentation/soft-dep.test.ts` -- covers RH-3, RH-4 (mock `pi.getAllTools()`)
- [ ] `tests/presentation/marketplace-list.test.ts` -- covers ML-1..2 byte-equality of one-line format
- [ ] `tests/helpers/git-mock.ts` -- `makeMockGitOps(state)` factory exercising stored-ref bookkeeping; supports forceUpdateRef (set ref → SHA), checkout (probe + transition), resolveRef (read), and clone (assert dir + url; copy fixture into dir). Used by `add.test.ts` and `update.test.ts`.
- [ ] `tests/fixtures/marketplaces/<name>/.claude-plugin/marketplace.json` -- in-process fixture clones (no real network)
- [ ] `tests/orchestrators/marketplace/_fixtures/` -- mirrored on the Phase 3 `tests/bridges/_fixtures/` precedent

*(All Wave 0 items are NEW. Phase 4 adds approximately 9 new test files plus a helper. Phase 1-3 produced 441 tests; Phase 4 expansion is purely additive -- no edits to existing tests.)*

______________________________________________________________________

## Open Questions (RESOLVED)

1. **`source.logical` access for both `PathSource` and `GitHubSource` in list rendering.**
   - **What we know:** `domain/source.ts:25-36` declares `PathSource.logical` but `GitHubSource` has only `raw` (and `owner`/`repo`/`ref`). V1's renderer used `source.logical` uniformly via a getter that mapped github sources to `https://github.com/<owner>/<repo>[#<ref>]`.
   - **What's unclear:** Should Phase 4 extend `GitHubSource` with a computed `logical` getter, or branch in the renderer on `kind`?
   - **Recommendation:** Add a `sourceLogical(source: ParsedSource): string` helper in `domain/source.ts` (pure function, type-narrowing on `kind`). Returns `source.raw` for path, `https://github.com/<owner>/<repo>[#<ref>]` for github. Use it in `list.ts`. This keeps `GitHubSource` immutable and avoids accessor inconsistencies.
   - **RESOLVED:** `sourceLogical(ParsedSource): string` helper added to `domain/source.ts` -- encoded in Plan 04-01 Task 2. Pure function with type-narrowing switch on `source.kind`; returns `source.logical` for path, `https://github.com/<owner>/<repo>[#<ref>]` for github, `source.raw` for unknown (NFR-12 forward-compat). Consumed by `presentation/marketplace-list.ts` (Plan 04-03 Task 3) and indirectly by `list.ts` (Plan 04-07).

2. **Reload-hint name list ordering for `marketplace remove`.**
   - **What we know:** MR-8 says "listing the dropped plugins". The cascade visits plugins in `Object.entries(record.plugins)` order (insertion order on most engines).
   - **What's unclear:** Is plugin-name alphabetical order required, or is insertion-order acceptable?
   - **Recommendation:** Sort alphabetically before passing to `reloadHint`. Deterministic output is the safer user-contract; tests can assert sorted order. PRD §6.8 RH-2 doesn't constrain order; PRD §5.1.2 MR-8 only says "listing".
   - **RESOLVED:** Alphabetical sort applied to the cascade primitive's plugin-name return path so consumers receive deterministic order -- encoded in Plan 04-02 Task 1 (`cascadeUnstagePlugin` ordering invariant) and Plan 04-06 Task 1 (`removeMarketplace` consumes the sorted `removedSorted` list before passing to `reloadHint("drop", removedSorted)`). Tests in Plan 04-06 Task 3 assert alphabetical order in the rendered hint.

3. **Whether `marketplace update` (bare, both scopes) re-reads each marketplace's manifest sequentially or batches.**
   - **What we know:** Deferred-ideas section says "Phase 4 implements sequentially". CONTEXT.md confirms.
   - **What's unclear:** None -- locked.
   - **RESOLVED:** Already locked in CONTEXT.md -- Phase 4 implements sequentially (no change). Encoded in Plan 04-08 Task 1 (`updateAllMarketplaces` iterates `targets` with a for-loop, one `await refreshOneMarketplace` per iteration).

4. **`RH-5` warning text exact phrasing for the soft-dep "install/load it ... and run /reload" suffix.**
   - **What we know:** `shared/markers.ts` only locks the prefix `pi-subagents is not loaded; ` and `pi-mcp-adapter is not loaded; `. The suffix is composed by `presentation/soft-dep.ts`.
   - **What's unclear:** Exact wording for the suffix. PRD §6.8 RH-5 says "include the canonical `<name> is not loaded; install/load it … and run /reload` warning line".
   - **Recommendation:** Phase 4 ships `<prefix>install/load it (e.g. via /pi:packages add npm:<name>) and run /reload.` -- one stable line. Snapshot test in `tests/presentation/soft-dep.test.ts`. If a future PRD revision tightens the contract, the test catches it.
   - **RESOLVED:** Phase 4 ships the suffix `install/load it (e.g. via /pi:packages add npm:<name>) and run /reload.` -- encoded in Plan 04-03 Task 2 (`soft-dep.ts` composes `${PI_SUBAGENTS_NOT_LOADED}install/load it (e.g. via /pi:packages add npm:pi-subagents) and run /reload.` and the parallel mcp-adapter form). Byte-equality snapshot test in `tests/presentation/soft-dep.test.ts` (Plan 04-03 Task 2) covers both forms.

5. **`marketplace remove` chained-cause depth for MR-3 cascade reporting.**
   - **What we know:** ES-4 says `formatErrorWithCauses` flattens to depth 5.
   - **What's unclear:** Phase 4 ships its own helper or waits for Phase 6's shared `formatErrorWithCauses`?
   - **Recommendation:** Ship a local copy in `orchestrators/marketplace/shared.ts` mirroring V1's reference (`marketplace/update.ts::formatErrorWithCauses`, lines 252-275). Phase 6 can later promote to a shared helper without changing Phase 4 behavior.
   - **RESOLVED:** Phase 4-local `formatErrorWithCauses` with the depth-5 bound -- encoded in Plan 04-02 Task 2 (added to `orchestrators/marketplace/shared.ts`; signature `formatErrorWithCauses(err: unknown, maxDepth: number = 5): string`). Consumed by `remove.ts` (Plan 04-06) and `update.ts` (Plan 04-08). Phase 6 may later promote to `shared/errors.ts` without changing the Phase 4 surface.
______________________________________________________________________

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥22 | All Phase 4 code | ✓ | (project floor) | -- |
| `isomorphic-git` | platform/git, GitOps default | ✓ | 1.37.6 | -- |
| `write-file-atomic` | atomic-json (indirect) | ✓ | 8.0.0 | -- |
| `typebox` | manifest validator + state validator | ✓ | 1.1.38 | -- |
| `@mariozechner/pi-coding-agent` | `ExtensionContext.pi.getAllTools()` for soft-dep probing | ✓ | 0.73.1 | -- |
| Network access (GitHub HTTPS, port 443) | Tests for `add` happy path with REAL clones | ✗ (offline tests required by D-12) | -- | All tests use `makeMockGitOps`; no network calls in CI. |
| `git` CLI | NONE -- isomorphic-git supersedes (D-21) | n/a | n/a | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** The "real network" path for live GitHub e2e is deferred to Phase 7 (live e2e against `anthropics/claude-plugins-official`), per ROADMAP. Phase 4 ships hermetic via `makeMockGitOps`.

______________________________________________________________________

## Sources

### Primary (HIGH confidence)

- `docs/prd/pi-claude-marketplace-prd.md` §5.1.1-§5.1.5 (MA/MR/ML/MU/MAU), §5.4 (cascade interaction), §6.2 (SC), §6.8 (RH), §6.9 (ST), §6.11 (AS), §6.12 (ES) -- authoritative spec for V1 user contract.
- `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` -- 14 locked decisions D-01..D-14; supersedes PRD MU-2/MU-3.
- `.planning/REQUIREMENTS.md` -- 38 owned REQ-IDs for Phase 4.
- On-disk verification (read 2026-05-10):
  - `extensions/pi-claude-marketplace/platform/git.ts` -- existing `clone`/`fetch`/`pull`/`checkout`/`resolveRef`/`listBranches`/`listRemotes` surface verified.
  - `extensions/pi-claude-marketplace/persistence/state-io.ts` -- `STATE_SCHEMA` includes `autoupdate?: boolean`, `manifestPath: string`, `marketplaceRoot: string`, `plugins: Record<...>` -- confirmed.
  - `extensions/pi-claude-marketplace/persistence/locations.ts` -- `ScopedLocations` brand + `sourceCloneDir(mp)` method exists; `sourcesDir` exposed; `agentsStagingDir` precedent for staging-dir pattern.
  - `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` -- guard contract confirmed.
  - `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp}/unstage.ts` -- four unstage signatures verified.
  - `extensions/pi-claude-marketplace/shared/{notify,markers,errors,fs-utils,path-safety,atomic-json}.ts` -- helper surfaces all confirmed.
  - `extensions/pi-claude-marketplace/domain/{source,manifest,name,resolver}.ts` -- domain primitives confirmed.
- `node_modules/isomorphic-git/index.d.ts` -- confirmed `writeRef({ ref, value, force, symbolic? })` for D-13's `forceUpdateRef`; confirmed `fetch`, `checkout`, `resolveRef` accept the parameters used in Pattern 3.
- `tests/architecture/import-boundaries.test.ts` -- D-11 forbidden-imports matrix; orchestrators/* must NOT import edge/*; bridges, transaction, persistence, presentation, platform, shared all permitted.
- npm registry, queried 2026-05-10:
  - `isomorphic-git@1.37.6`
  - `write-file-atomic@8.0.0`
  - `typebox@1.1.38`

### Secondary (MEDIUM confidence)

- V1 reference at `git show features/initial:extensions/pi-claude-marketplace/marketplace/{add,remove,list,update,autoupdate}.ts` -- pattern reference; V1 uses `git pull --ff-only` semantics now superseded by D-14.
- V1 `presentation/reload-hint.ts` and `presentation/marketplace-list.ts` -- shape reference for Phase 4 presentation helpers; confirmed verb table + format string + softer-dep probe pattern.
- `.planning/research/PITFALLS.md` -- Pitfalls 1, 3, 4, 5 directly applicable to Phase 4 (EXDEV, soft-dep coupling, AG-5 marker drift, schema migration).
- `.planning/phases/03-resource-bridges/VERIFICATION.md` -- Phase 3 closure confirms 441 tests green; bridges' unstage contracts validated.

### Tertiary (LOW confidence)

- isomorphic-git `pull` exact merge semantics (not consumed by Phase 4 per D-13; flagged here in case a future planner revisits).

______________________________________________________________________

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims in this research were verified against on-disk source, npm registry, or PRD/CONTEXT artifacts. | -- | -- |

The research surface used `[VERIFIED]` evidence throughout. The recommended `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` suffix wording is `[CITED: PRD §6.8 RH-5]` for the prefix and is locked by `shared/markers.ts`; the suffix is the Phase 4 author's choice within RH-5's "install/load it … and run /reload" guidance and is captured under Open Question 4 for explicit user signoff at plan time.

______________________________________________________________________

## State of the Art

| Old Approach (V1) | Current Approach (Phase 4) | When Changed | Impact |
|-------------------|----------------------------|--------------|--------|
| `execFile("git", [...])` shell-out | `isomorphic-git` JS-native | Phase 1 D-18..21 | Eliminates MA-7 "git not found" failure mode entirely (D-21 supersedes MA-7). |
| Hand-rolled `atomicWriteJson` in `fs-utils.ts` | `write-file-atomic@^8.0.0` via `shared/atomic-json.ts` | Phase 1 D-03 | Audited, fsync + queue, signal-cleanup. |
| `git pull --ff-only` + non-fast-forward divergence error (PRD MU-2/MU-3) | D-14 follow-upstream-blindly: `fetch + forceUpdateRef + checkout`; no `pull` verb | **Phase 4 D-14 (this phase)** | Read-only-local invariant locked; one fewer user-visible failure mode; supersedes PRD MU-2/MU-3 in `.planning/` artifacts. |
| Cascade halts on first plugin failure (V1's earliest version, pre-MR-3 fix) | Hand-rolled try/catch loop with `failedPlugins[]` aggregation; record retained when any plugin fails | Phase 4 D-02/D-03 | MR-3 + MR-4 contract; matches V1 current behavior; documented as "NOT runPhases" to forestall future refactoring. |
| `git fetch` + `git pull --ff-only` exit-code introspection on `GitRunError` | No introspection -- any failure → `MarketplaceUpdateError` with cause chained | Phase 4 D-14 | Simpler error taxonomy; one user-visible class. |

**Deprecated/outdated (Phase 4 must NOT regress):**

- V1's `marketplace/git.ts::syncClone` (V1 `pull --ff-only` choreography) -- replaced by Pattern 3.
- V1's `transaction/state-guard.ts::loadStateExpectingMarketplace` -- Phase 4 reads inside the guard instead.
- V1's `console.warn` outside the IL-3 sanctioned site -- forbidden in Phase 4.

______________________________________________________________________

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- every package version verified against npm registry on 2026-05-10; every Phase 1-3 carry-forward symbol read on disk and confirmed.
- Architecture: HIGH -- D-01..D-14 lock the design space; only one open layout question (Open Q1) remains, and its resolution doesn't affect plan structure.
- Pitfalls: HIGH -- Pitfalls 1-9 cross-reference PRD or `.planning/research/PITFALLS.md`; Pitfall 10 is V1-derived from `marketplace/update.ts::formatErrorWithCauses` (read directly).

**Research date:** 2026-05-10
**Valid until:** 2026-06-09 (30 days for stable deps + locked-decision phase). isomorphic-git semver minor bumps within 1.37.x are routine; if 1.38.0 changes `writeRef` semantics (extremely unlikely), revisit Pattern 3.
