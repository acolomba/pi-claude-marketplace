# Roadmap: pi-claude-marketplace (Successor Architecture)

## Overview

This is a successor-architecture build, not a greenfield project. V1 already exists on `features/initial` and the PRD (`docs/prd/pi-claude-marketplace-prd.md` v1.0, 1068 lines) is its authoritative specification. The successor's job is consolidation and hardening: ~85% of PRD requirements carry forward verbatim from V1, with a small set of targeted refactors (atomic-IO via `write-file-atomic`, Phase ledger primitive replacing nested try/catches, `MARKERS.ts` constants module preventing ES-5 drift, symlink-aware `assertPathInside`). The journey runs dependency-graph inside-out: foundations and primitives first (Phases 1-2), then bridges in parallel (Phase 3), then orchestrators (marketplace then plugin, Phases 4-5), then edge layer (Phase 6), then integration and live e2e wiring against `anthropics/claude-plugins-official` (Phase 7). Each phase produces a complete typed foundation for the next; pitfall mitigations are placed in the earliest phase where they are buildable so they propagate forward rather than being retrofitted.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundations & Toolchain** - Atomic IO, symlink-aware containment, MARKERS constants, output-channel discipline, ESM baseline, CI matrix
- [ ] **Phase 2: Domain Core & Persistence Primitives** - Pure resolver, TypeBox manifest schemas, branded ScopedLocations, state persistence, withStateGuard + Phase ledger
- [ ] **Phase 3: Resource Bridges** - Skills, commands, agents, MCP servers staging with prepare/commit/abort discipline
- [ ] **Phase 4: Marketplace Orchestrators** - `marketplace add/remove/list/update/autoupdate`, reload-hint and soft-dep presentation primitives
- [ ] **Phase 5: Plugin Orchestrators** - `install/uninstall/update` using Phase ledger + all four bridges; top-level `list`; component-path supplement fix
- [ ] **Phase 6: Edge Layer & Tab Completion** - `/claude:plugin` router, argument parsing, tab completion, Usage blocks, error formatting
- [ ] **Phase 7: Integration & Pi Wiring** - `index.ts` entrypoint, `platform/pi-api.ts` wrapper, live e2e tests with pinned-SHA strategy, peer-dep floor

## Phase Details

### Phase 1: Foundations & Toolchain

**Goal**: Every subsequent phase has atomic IO, symlink-safe containment, stable user-contract markers, output-channel discipline, ESM baseline, and CI matrix to build on **Depends on**: Nothing (first phase) **Requirements**: NFR-1, NFR-4, NFR-6, NFR-9, NFR-10, IL-1, IL-2, IL-3, IL-4, IL-5, ES-1, ES-2, ES-3, ES-4, ES-5, PS-1, PS-2, PS-3, PS-4, PS-5, AS-1, AS-4, AS-5 **Success Criteria** (what must be TRUE):

1. JSON writes to `state.json` / `mcp.json` / `agents-index.json` survive a kernel-crash simulation (fsync of file + parent dir; `write-file-atomic@^8` adopted)
2. A test plugin containing a symlink whose target escapes the scope root is rejected with `PathContainmentError` before any byte is written
3. ESLint emits an error when any file under `src/edge/`, `src/orchestrators/`, or `src/bridges/` calls `process.stdout.write` / `process.stderr.write` / `console.warn` outside the one sanctioned `migrateLegacyMarketplaceRecords` callsite
4. `MARKERS.ts` exports the five ES-5 verbatim strings (pi-subagents, pi-mcp-adapter, reload hint, manual recovery, rollback partial) and a snapshot test asserts byte-for-byte PRD equivalence
5. `npm run check` (typecheck + ESLint + Prettier + `node --test`) passes on Node 22, 24, and 26 in CI **Plans**: TBD

### Phase 2: Domain Core & Persistence Primitives

**Goal**: A typed, I/O-free foundation exists for source parsing, manifest schemas, plugin resolution, naming, state shapes, transaction semantics, and the Phase ledger primitive that install/update will reuse **Depends on**: Phase 1 **Requirements**: NFR-7, NFR-12, SP-1, SP-2, SP-3, SP-4, SP-5, SP-6, SP-7, SC-1, SC-2, SC-3, SC-4, SC-7, MM-1, MM-2, MM-3, MM-4, MM-5, MM-6, MM-7, PR-1, PR-2, PR-3, PR-4, PR-5, PR-6, RN-1, RN-2, ST-1, ST-2, ST-3, ST-4, ST-5, ST-6, ST-7, ST-8, ST-9 **Success Criteria** (what must be TRUE):

1. The resolver returns a discriminated union where TypeScript refuses to compile any code that reads `pluginRoot` from a non-installable variant (verified by a `// @ts-expect-error` test)
2. Source-parser fixtures cover every accept/reject case in PRD §6.1 (owner/repo, https GitHub with `.git`/`#ref`/trailing slash, paths starting with `/`, `./`, `../`, `~`, plus rejects for `git@`, `://` non-github, browser-paste `/tree/<ref>`, `owner/repo@ref`, `~user/foo`)
3. `withStateGuard` round-trips an in-process concurrent install: second caller observes the first's commit, hard-fails with "was installed concurrently" on conflicting target, soft-converges on idempotent uninstall
4. Legacy `state.json` records (missing `manifestPath` / `marketplaceRoot`, missing `resources.agents` / `resources.mcpServers`) load successfully and are normalized; the single sanctioned `console.warn` fires only when async best-effort migration save fails
5. SHA-256 12-hex content hash is stable across a snapshot test (algorithm + truncation length + walk-filter list locked as user contract per PI-7) **Plans**: TBD

### Phase 3: Resource Bridges

**Goal**: All four resource bridges (skills, commands, agents, MCP servers) stage and unstage atomically with bridge-local prepare/commit/abort, marker discipline, and per-bridge collision/ownership guards **Depends on**: Phase 2 **Requirements**: SK-1, SK-2, SK-3, SK-4, SK-5, CM-1, CM-2, CM-3, CM-4, AG-1, AG-2, AG-3, AG-4, AG-5, AG-6, AG-7, AG-8, AG-9, AG-10, AG-11, AG-12, MC-1, MC-2, MC-3, MC-4, MC-5, MC-6, MC-7, MC-8, RN-4, RN-5, RN-6, AS-8, AS-9 **Success Criteria** (what must be TRUE):

1. A test plugin with skills, commands, agents, and MCP servers stages all four kinds; each artefact lands at its PRD-specified path with the correct generated name (`<plugin>-<skill>`, `<plugin>:<command>`, `claude-marketplace-<plugin>-<agent>`, MCP entry merged into `mcp.json`) and `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substituted in bodies
2. Every staged agent file starts with `claude-marketplace-` AND contains the verbatim `generated by pi-claude-marketplace` HTML-comment marker; foreign content at a target file (basename or marker missing) is retained in the index with `failed[]` and is not overwritten
3. Re-staging an agent owned by a different `(marketplace, plugin)` throws with the conflicting owner; MCP server-name collisions are checked across all four `pi-mcp-adapter` slots from a single `MCP_COLLISION_SLOTS` constant; foreign collisions refuse stage while same-scope self-replace is allowed
4. A plugin with empty `mcpServers` map and no previous-ours entries does NOT materialize `mcp.json`; a plugin with empty agents source dir and no previous-ours entries does NOT materialize the scoped agents dir or `agents-index.json`
5. `agents-index.json` partitions by `(marketplace, plugin)` so re-staging affects only owning rows; per-row validation failures soft-fail (drop row, warn) while file-level corruption throws loudly **Plans**: TBD

### Phase 4: Marketplace Orchestrators

**Goal**: A user can manage marketplace records (`add`, `remove`/`rm`, `list`, `update`, `autoupdate`/`noautoupdate`) with atomic clone-then-rename, cascade with aggregated failures, manifest pointer refresh, and reload-hint emission only when resources actually change **Depends on**: Phases 2, 3 **Requirements**: MA-1, MA-2, MA-3, MA-4, MA-5, MA-6, MA-7, MA-8, MA-9, MA-10, MA-11, MR-1, MR-2, MR-3, MR-4, MR-5, MR-6, MR-7, MR-8, ML-1, ML-2, ML-3, ML-4, MU-1, MU-2, MU-3, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9, MAU-1, MAU-2, MAU-3, MAU-4, SC-5, SC-6, RH-1, RH-2, RH-3, RH-4, RH-5, NFR-5 **Success Criteria** (what must be TRUE):

1. `marketplace add anthropics/claude-plugins-official` clones into `<staging>/<uuid>/`, reads the manifest, atomically renames into final location, persists the record, and emits `Added marketplace "<name>" in user scope.` with NO reload hint (MA-11)
2. `marketplace remove <name>` cascade-drops every installed plugin's resources, aggregates per-plugin failures into `failedPlugins[]` with `Error.cause`, retains the record when any plugin failed, and emits exactly ONE `warning`-severity notification ending with "fix the underlying issue and retry"
3. `marketplace update` against a GitHub source runs `git fetch` + `git pull --ff-only` (or re-checkouts a stored ref on detached HEAD), refuses non-fast-forward divergence with a clear error, refreshes the manifest pointer before any cascade, and only cascades plugin upgrades when the per-marketplace `autoupdate` flag is true
4. `marketplace list` shows one line per marketplace grouped by scope, formatted `<icon> <name> (<source.logical>) [autoupdate]?`, WITHOUT loading any marketplace's manifest, and emits `No marketplaces configured.` when both scopes are empty
5. The reload hint follows PRD §6.8 verbatim (`Run /reload to load it.` / `Run /reload to load "n1", "n2", ...".`, verbs `load`/`refresh`/`drop`), is emitted ONLY when generated resources changed, and `pi-subagents` / `pi-mcp-adapter` warnings (probed via `pi.getAllTools()`) appear BEFORE the trailing reload hint when the relevant dep is unloaded
6. Network is touched only by GitHub-source `marketplace add` and `marketplace update`; path-source `add`, `list`, `remove`, and the autoupdate flag flips MUST NOT touch the network **Plans**: TBD

### Phase 5: Plugin Orchestrators

**Goal**: A user can `install`, `uninstall`, and `update` plugins with 4-phase atomic staging (skills/prompts → agents → MCP → state commit), 3-phase atomic update (prepare → state-guard swap → physical replace), phase-ordered rollback with `(rollback partial: …)` aggregation, top-level `list` filters, and Gap 3 component-path supplement-not-replace correction **Depends on**: Phases 3, 4 **Requirements**: PI-1, PI-2, PI-3, PI-4, PI-5, PI-6, PI-7, PI-8, PI-9, PI-10, PI-11, PI-12, PI-13, PI-14, PI-15, PU-1, PU-2, PU-3, PU-4, PU-5, PU-6, PU-7, PU-8, PUP-1, PUP-2, PUP-3, PUP-4, PUP-5, PUP-6, PUP-7, PUP-8, PUP-9, PL-1, PL-2, PL-3, PL-4, PL-5, PL-6, PL-7, RN-3, AS-2, AS-3, AS-6, AS-7, NFR-2, NFR-3 **Success Criteria** (what must be TRUE):

1. `install <plugin>@<marketplace>` consults the cached manifest only (NO network sync, asymmetric with `update`), stages skills/prompts → agents → MCP in order, commits state last, and rolls back earlier phases on any phase failure with `(rollback partial: [<phase>] <msg>; …)` aggregation; `PathContainmentError` is NEVER folded into the rollback-partial line
2. Install conflict guards run BEFORE any disk write: cross-plugin name conflicts (skill, prompt, agent) block install with one message listing every conflicting name; cross-marketplace agent ownership refuses to overwrite; `dependencies` declarations install with a manual-install warning
3. `update` runs `syncClone` once per marketplace, computes resolved version, partitions plugins into `updated`/`unchanged`/`skipped`/`failed`, executes the 3-phase atomic swap (prepare in tmp → state-guard swap with old-resource snapshot → physical replace + soft-dep commit), aggregates phase-3a failures before phase-3b, and emits a recovery hint pointing at uninstall+install on phase-3 failure
4. `uninstall` orders correctly (skills/prompts → agents → MCP → state commit → per-plugin data dir), survives concurrent uninstall by another process via silent converge, refuses loudly when foreign content is found at an agent target file (PU-7), and emits `Run /reload to drop "<plugin>"` only when at least one resource was removed
5. Top-level `list` (no flags) shows every bucket grouped by scope; with a marketplace name shows only that marketplace; each entry shows icon (●/○/⊘), name, optional `(<version>)`, status marker, description on second indented line truncated at column 66; `upgradable` flag is set iff manifest version differs (string compare) from install record; manifest load failure shows `[warning] could not load manifest: <reason>` and STILL renders installed plugins
6. Custom component-path arrays SUPPLEMENT defaults rather than replace them (Gap 3 / COMP-01 fix vs. V1 behavior), documented in CHANGELOG as "behavior corrected vs. V1" **Plans**: TBD

### Phase 6: Edge Layer & Tab Completion

**Goal**: A Pi user can drive `/claude:plugin` end-to-end: subcommand routing with Usage blocks on empty/unknown input, quoted-argument tokenization, `--scope` validation, fish-style space normalization, and tab completion at every position with soft-fail on per-marketplace manifest errors **Depends on**: Phase 5 **Requirements**: AP-1, AP-2, AP-3, AP-4, TC-1, TC-2, TC-3, TC-4, TC-5, TC-6, TC-7, TC-8, TC-9 **Success Criteria** (what must be TRUE):

1. Tab completion at the first positional after `/claude:plugin` surfaces `install / uninstall / update / list / marketplace`; after `marketplace` surfaces `add / remove / list / update / autoupdate / noautoupdate` (`rm` accepted but not surfaced); after `--scope` surfaces only `user` and `project`
2. Plugin tokens for `install/uninstall/update <here>` complete to `<plugin>@<marketplace>` form per PRD §6.6 detail rules; `update` accepts the bare `@<marketplace>` form; per-marketplace manifest-load failures soft-fail to empty set while top-level `state.json` errors propagate (no silent hide)
3. Argument parser tokenizes single- and double-quoted spaced arguments correctly, rejects missing/invalid `--scope` value with a clear error, accepts `--scope` at any position, and emits the relevant `Usage:` block at `error` severity on empty/unknown subcommand
4. All terminal completions include trailing space; double-space collapse via fish-style normalization scoped to `/claude:plugin` (does not affect other commands)
5. Every user-visible message routes through `ctx.ui.notify` via the typed wrapper from Phase 1; ESLint blocks any new `process.stdout`/`stderr` write in `src/edge/` **Plans**: TBD **UI hint**: yes

### Phase 7: Integration & Pi Wiring

**Goal**: The extension loads in a real Pi process, registers `/claude:plugin` and `resources_discover`, survives multi-process concurrency, passes a live e2e suite against `anthropics/claude-plugins-official` at a pinned SHA (PR CI) and floating main (nightly), and pins a peer-dep floor for `@mariozechner/pi-coding-agent` **Depends on**: Phase 6 **Requirements**: NFR-2, NFR-3, NFR-8, NFR-11 **Success Criteria** (what must be TRUE):

1. `index.ts` registers `/claude:plugin` command and `resources_discover` against `@mariozechner/pi-coding-agent@^0.73.1`; the `platform/pi-api.ts` wrapper makes orchestrators testable without a live Pi instance, and the wrapper surface is verified against the current `types.d.ts` (research flag from SUMMARY.md addressed)
2. A live e2e suite installs ≥3 representative plugins from `anthropics/claude-plugins-official` at a pinned SHA, exercises the soft-dep degraded path (with and without `pi-subagents` / `pi-mcp-adapter` loaded), and verifies the `Run /reload` hint causes the new resources to surface; the same suite runs nightly against floating `main` and classifies failures by mode (upstream change vs. regression)
3. A multi-process concurrency test starts two Pi processes both targeting the same scope, both running `install` simultaneously, and verifies one wins cleanly while the other rolls back with the documented "was installed concurrently" error
4. Peer dependency `@mariozechner/pi-coding-agent` declares a pinned floor (≥0.70.6 minimum, ideally ≥0.73.1 if no breaking change observed); package publish dry-run validates the manifest
5. Architecture verifiably supports adding manifest-mtime caching later (NFR-8 BACKLOG): a single seam exists where `marketplace.json` is read on the manifest path, isolated from orchestrator logic **Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 (decimals slot in between if inserted)

| Phase                                   | Plans Complete | Status      | Completed |
| --------------------------------------- | -------------- | ----------- | --------- |
| 1. Foundations & Toolchain              | 0/TBD          | Not started | -         |
| 2. Domain Core & Persistence Primitives | 0/TBD          | Not started | -         |
| 3. Resource Bridges                     | 0/TBD          | Not started | -         |
| 4. Marketplace Orchestrators            | 0/TBD          | Not started | -         |
| 5. Plugin Orchestrators                 | 0/TBD          | Not started | -         |
| 6. Edge Layer & Tab Completion          | 0/TBD          | Not started | -         |
| 7. Integration & Pi Wiring              | 0/TBD          | Not started | -         |
