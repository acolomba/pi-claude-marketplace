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
- [x] **Phase 3: Resource Bridges** - Skills, commands, agents, MCP servers staging with prepare/commit/abort discipline
- [x] **Phase 4: Marketplace Orchestrators** - `marketplace add/remove/list/update/autoupdate`, reload-hint and soft-dep presentation primitives
- [x] **Phase 5: Plugin Orchestrators** - `install/uninstall/update` using Phase ledger + all four bridges; top-level `list`; component-path supplement fix
- [x] **Phase 6: Edge Layer & Tab Completion** - `/claude:plugin` router, argument parsing, tab completion, Usage blocks, error formatting
- [ ] **Phase 7: Integration & Pi Wiring** - `index.ts` entrypoint, `platform/pi-api.ts` wrapper, live e2e tests with pinned-SHA strategy, peer-dep floor
- [x] **Phase 10: Claude Settings Import Foundation** - Read/merge Claude settings, extract enabled plugin refs, map marketplace sources including official built-in marketplace
- [x] **Phase 11: Import Command Orchestration** - `/claude:plugin import [--scope user|project]` handler, idempotent marketplace/plugin orchestration, warnings and reload-hint integration

## Phase Details

### Phase 1: Foundations & Toolchain

**Goal**: Every subsequent phase has atomic IO, symlink-safe containment, stable user-contract markers, output-channel discipline, ESM baseline, and CI matrix to build on **Depends on**: Nothing (first phase) **Requirements**: NFR-1, NFR-4, NFR-6, NFR-9, NFR-10, IL-1, IL-2, IL-3, IL-4, IL-5, ES-1, ES-2, ES-3, ES-4, ES-5, PS-1, PS-2, PS-3, PS-4, PS-5, AS-1, AS-4, AS-5 **Success Criteria** (what must be TRUE):

1. JSON writes to `state.json` / `mcp.json` / `agents-index.json` survive a kernel-crash simulation (fsync of file + parent dir; `write-file-atomic@^8` adopted)

2. A test plugin containing a symlink whose target escapes the scope root is rejected with `PathContainmentError` before any byte is written

3. ESLint emits an error when any file under `src/edge/`, `src/orchestrators/`, or `src/bridges/` calls `process.stdout.write` / `process.stderr.write` / `console.warn` outside the one sanctioned `migrateLegacyMarketplaceRecords` callsite

4. `shared/markers.ts` exports the five ES-5 verbatim strings (pi-subagents, pi-mcp-adapter, reload hint, manual recovery, rollback partial) and a snapshot test asserts each export is a byte-for-byte **prefix** of the corresponding PRD §6.12 literal (the runtime caller appends parameter context after the prefix; see Phase 1 CONTEXT.md decision B-4)

   **Note (2026-05-09, resolved):** Original criterion text said "byte-for-byte PRD equivalence" which would force markers.ts to embed runtime parameter context. CONTEXT.md decision B-4 locks prefix-equivalence as the correct semantic; user signed off (`approved-prefix-equivalence`) at the Plan 07 checkpoint. The `markers-snapshot.test.ts` assertion enforces prefix-equality.

5. `npm run check` (typecheck + ESLint + Prettier + `node --test`) passes on Node 24 in CI

   **Note (2026-05-09, resolved):** Original criterion text said "Node 22, 24, and 26 in CI" but Phase 1 CONTEXT.md decision D-01 locked the matrix to Node 24 only ("removes the matrix maintenance overhead"). User signed off (`approved-d01`) at the Plan 07 checkpoint. Workflow is matrix-ready -- a future reopen adds `strategy.matrix.node-version` without rewriting the rest.

**Plans**: 7 plans

- [ ] `01-01-PLAN.md` -- Toolchain rewire: package.json + eslint.config.js (Wave 0)
- [ ] `01-02-PLAN.md` -- shared/ core: markers, errors, notify, atomic-json, path-safety (Wave 1)
- [ ] `01-03-PLAN.md` -- 9-folder skeleton + READMEs + platform/git.ts (isomorphic-git wrapper) (Wave 1)
- [ ] `01-04-PLAN.md` -- index.ts entrypoint + delete legacy stub + REQUIREMENTS/PROJECT D-21 supersession (Wave 1)
- [ ] `01-05-PLAN.md` -- tests/architecture/\* + prd-extract helper + canary fixture (Wave 2)
- [ ] `01-06-PLAN.md` -- tests/shared/\* unit tests + index-smoke regression guard (Wave 2)
- [ ] `01-07-PLAN.md` -- .github/workflows/ci.yml + closing checkpoint + Phase 2 handoff SUMMARY (Wave 3)

### Phase 2: Domain Core & Persistence Primitives

**Goal**: A typed, I/O-free foundation exists for source parsing, manifest schemas, plugin resolution, naming, state shapes, transaction semantics, and the Phase ledger primitive that install/update will reuse **Depends on**: Phase 1 **Requirements**: NFR-7, NFR-12, SP-1, SP-2, SP-3, SP-4, SP-5, SP-6, SP-7, SC-1, SC-2, SC-3, SC-4, SC-7, MM-1, MM-2, MM-3, MM-4, MM-5, MM-6, MM-7, PR-1, PR-2, PR-3, PR-4, PR-5, PR-6, RN-1, RN-2, ST-1, ST-2, ST-3, ST-4, ST-5, ST-6, ST-7, ST-8, ST-9 **Success Criteria** (what must be TRUE):

1. The resolver returns a discriminated union where TypeScript refuses to compile any code that reads `pluginRoot` from a non-installable variant (verified by a `// @ts-expect-error` test)
2. Source-parser fixtures cover every accept/reject case in PRD §6.1 (owner/repo, https GitHub with `.git`/`#ref`/trailing slash, paths starting with `/`, `./`, `../`, `~`, plus rejects for `git@`, `://` non-github, browser-paste `/tree/<ref>`, `owner/repo@ref`, `~user/foo`)
3. `withStateGuard` round-trips an in-process concurrent install: second caller observes the first's commit, hard-fails with "was installed concurrently" on conflicting target, soft-converges on idempotent uninstall
4. Legacy `state.json` records (missing `manifestPath` / `marketplaceRoot`, missing `resources.agents` / `resources.mcpServers`) load successfully and are normalized; the single sanctioned `console.warn` fires only when async best-effort migration save fails
5. SHA-256 12-hex content hash is stable across a snapshot test (algorithm + truncation length + walk-filter list locked as user contract per PI-7)

**Plans**: 6 plans

- [ ] `02-01-PLAN.md` -- shared/types.ts (Scope) + domain/source.ts (parsePluginSource + factories) + tests (Wave 1)
- [ ] `02-02-PLAN.md` -- domain/manifest.ts + components/{plugin,mcp}.ts (TypeBox JIT validators) + tests (Wave 1)
- [ ] `02-03-PLAN.md` -- domain/name.ts (assertSafeName + 3 generators) + domain/version.ts (computeHashVersion + HASH_WALK_SKIP) + hash-stability fixtures + tests (Wave 1)
- [ ] `02-04-PLAN.md` -- persistence/{locations,state-io,migrate}.ts (ScopedLocations brand + STATE_SCHEMA + IL-3 sanctioned console.warn) + 3 legacy fixtures + tests (Wave 2)
- [ ] `02-05-PLAN.md` -- domain/resolver.ts (ResolvedPlugin discriminated union + resolveStrict + resolveLoose + requireInstallable) + NFR-7 type-level test + strict/loose tests (Wave 2)
- [ ] `02-06-PLAN.md` -- transaction/{phase-ledger,rollback,with-state-guard}.ts + tests (SC-3 in-process concurrent verifier) (Wave 3)

### Phase 3: Resource Bridges

**Goal**: All four resource bridges (skills, commands, agents, MCP servers) stage and unstage atomically with bridge-local prepare/commit/abort, marker discipline, and per-bridge collision/ownership guards **Depends on**: Phase 2 **Requirements**: SK-1, SK-2, SK-3, SK-4, SK-5, CM-1, CM-2, CM-3, CM-4, AG-1, AG-2, AG-3, AG-4, AG-5, AG-6, AG-7, AG-8, AG-9, AG-10, AG-11, AG-12, MC-1, MC-2, MC-3, MC-4, MC-5, MC-6, MC-7, MC-8, RN-4, RN-5, RN-6, AS-8, AS-9 **Success Criteria** (what must be TRUE):

1. A test plugin with skills, commands, agents, and MCP servers stages all four kinds; each artefact lands at its PRD-specified path with the correct generated name (`<plugin>-<skill>`, `<plugin>:<command>`, `pi-claude-marketplace-<plugin>-<agent>`, MCP entry merged into `mcp.json`) and `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substituted in bodies
2. Every staged agent file starts with `pi-claude-marketplace-` AND contains the verbatim `generated by pi-claude-marketplace` HTML-comment marker; foreign content at a target file (basename or marker missing) is retained in the index with `failed[]` and is not overwritten
3. Re-staging an agent owned by a different `(marketplace, plugin)` throws with the conflicting owner; MCP server-name collisions are checked across all four `pi-mcp-adapter` slots from a single `MCP_COLLISION_SLOTS` constant; foreign collisions refuse stage while same-scope self-replace is allowed
4. A plugin with empty `mcpServers` map and no previous-ours entries does NOT materialize `mcp.json`; a plugin with empty agents source dir and no previous-ours entries does NOT materialize the scoped agents dir or `agents-index.json`
5. `agents-index.json` partitions by `(marketplace, plugin)` so re-staging affects only owning rows; per-row validation failures soft-fail (drop row, warn) while file-level corruption throws loudly

**Plans**: 7 plans

- [ ] `03-01-PLAN.md` -- Wave 0: shared primitives (vars.ts, errors-bridges.ts, fs-utils.ts) + ScopedLocations bridge-target paths + test fixture corpora (Wave 1)
- [ ] `03-02-PLAN.md` -- agents-index persistence: TypeBox schema + JIT validator + atomic IO (Wave 1)
- [ ] `03-03-PLAN.md` -- Skills bridge: prepare/commit/abort/unstage + frontmatter rewrite + per-skill atomic dir rename (Wave 2)
- [ ] `03-04-PLAN.md` -- Commands bridge: prepare/commit/abort/unstage + per-file atomic rename + CM-3 substitution (Wave 2)
- [ ] `03-05-PLAN.md` -- Agents bridge: marker discipline + AG-7 conversion pipeline + ownership guard + agents-index mutation (Wave 2)
- [ ] `03-06-PLAN.md` -- MCP bridge: precedence chain + 4-slot collision check + _piClaudeMarketplace marker + AS-8 noop (Wave 2)
- [ ] `03-07-PLAN.md` -- Multi-bridge integration tests + foreign-content/materialization-gate end-to-end + VALIDATION.md sign-off (Wave 3)

### Phase 4: Marketplace Orchestrators

**Goal**: A user can manage marketplace records (`add`, `remove`/`rm`, `list`, `update`, `autoupdate`/`noautoupdate`) with atomic clone-then-rename, cascade with aggregated failures, manifest pointer refresh, and reload-hint emission only when resources actually change **Depends on**: Phases 2, 3 **Requirements**: MA-1, MA-2, MA-3, MA-4, MA-5, MA-6, ~~MA-7~~ (superseded by Phase 1 D-21), MA-8, MA-9, MA-10, MA-11, MR-1, MR-2, MR-3, MR-4, MR-5, MR-6, MR-7, MR-8, ML-1, ML-2, ML-3, ML-4, MU-1, MU-2, MU-3, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9, MAU-1, MAU-2, MAU-3, MAU-4, SC-5, SC-6, RH-1, RH-2, RH-3, RH-4, RH-5, NFR-5 **Success Criteria** (what must be TRUE):

1. `marketplace add anthropics/claude-plugins-official` clones into `<staging>/<uuid>/`, reads the manifest, atomically renames into final location, persists the record, and emits `Added marketplace "<name>" in user scope.` with NO reload hint (MA-11)
2. `marketplace remove <name>` cascade-drops every installed plugin's resources, aggregates per-plugin failures into `failedPlugins[]` with `Error.cause`, retains the record when any plugin failed, and emits exactly ONE `warning`-severity notification ending with "fix the underlying issue and retry"
3. `marketplace update` against a GitHub source follows upstream blindly via `gitOps.fetch` + `gitOps.forceUpdateRef` + `gitOps.checkout` (Phase 4 D-14 supersedes PRD MU-2/MU-3 -- the local clone is read-only by contract, so non-fast-forward divergence cannot occur). Manifest pointer is refreshed and persisted before any cascade; plugin upgrades cascade only when the per-marketplace `autoupdate` flag is true
4. `marketplace list` shows one line per marketplace grouped by scope, formatted `<icon> <name> (<source.logical>) [autoupdate]?`, WITHOUT loading any marketplace's manifest, and emits `No marketplaces configured.` when both scopes are empty
5. The reload hint follows PRD §6.8 verbatim (`Run /reload to load it.` / `Run /reload to load "n1", "n2", ...".`, verbs `load`/`refresh`/`drop`), is emitted ONLY when generated resources changed, and `pi-subagents` / `pi-mcp-adapter` warnings (probed via `pi.getAllTools()`) appear BEFORE the trailing reload hint when the relevant dep is unloaded
6. Network is touched only by GitHub-source `marketplace add` and `marketplace update`; path-source `add`, `list`, `remove`, and the autoupdate flag flips MUST NOT touch the network

**Note (2026-05-10):** PRD MU-2 and MU-3 are superseded by Phase 4 D-14 ("follow-upstream-blindly" semantics). The local marketplace clone is read-only by contract; `marketplace update` overwrites the local branch ref to the remote SHA via `forceUpdateRef + checkout` instead of `pull --ff-only`. Recorded in REQUIREMENTS.md and PROJECT.md by Plan 04-10.

**Plans**: 10 plans

- [x] `04-01-PLAN.md` -- Wave 1 foundations: 4 error classes + sourcesStagingDir + sourceLogical + orchestrators/types.ts (Wave 1)
- [x] `04-02-PLAN.md` -- Wave 1 shared.ts: GitOps interface + DEFAULT_GIT_OPS + cascadeUnstagePlugin + resolveScopeFromState + applyAutoupdateFlip + formatErrorWithCauses (Wave 1)
- [x] `04-03-PLAN.md` -- Wave 1 presentation: reload-hint.ts + soft-dep.ts + marketplace-list.ts + tests (Wave 1)
- [x] `04-04-PLAN.md` -- Wave 1 test infrastructure: tests/helpers/git-mock.ts + 3 marketplace fixtures (Wave 1)
- [x] `04-05-PLAN.md` -- Wave 2 add.ts: marketplace add (github + path branches; MA-1..6, MA-8..11, MA-9 cleanup) + tests (Wave 2)
- [x] `04-06-PLAN.md` -- Wave 2 remove.ts + cascade.test.ts: cascade fan-out, MR-3 aggregation, MR-4 single warning, MR-5/6/7 post-state cleanup (Wave 2)
- [x] `04-07-PLAN.md` -- Wave 2 list.ts: read-only orchestrator (no guard, no manifest reads, no network) + tests (Wave 2)
- [x] `04-08-PLAN.md` -- Wave 2 update.ts: D-14 fetch+forceUpdateRef+checkout sequence, outer-guard/cascade-outside, MU-7 partition rendering + tests (Wave 2)
- [x] `04-09-PLAN.md` -- Wave 2 autoupdate.ts: idempotent flip via applyAutoupdateFlip, MAU-1..4 + SC-6 + tests (Wave 2)
- [x] `04-10-PLAN.md` -- Wave 3 documentation supersession: REQUIREMENTS.md MU-2/MU-3 strikethrough + PROJECT.md D-23 row (Wave 3)

### Phase 5: Plugin Orchestrators

**Goal**: A user can `install`, `uninstall`, and `update` plugins with 4-phase atomic staging (skills/prompts → agents → MCP → state commit), 3-phase atomic update (prepare → state-guard swap → physical replace), phase-ordered rollback with `(rollback partial: …)` aggregation, top-level `list` filters, scope-aware marketplace sourcing, dual-scope plugin installs, and Gap 3 component-path supplement-not-replace correction **Depends on**: Phases 3, 4 **Requirements**: PI-1, PI-2, PI-3, PI-4, PI-5, PI-6, PI-7, PI-8, PI-9, PI-10, PI-11, PI-12, PI-13, PI-14, PI-15, PI-16, PI-17, PU-1, PU-2, PU-3, PU-4, PU-5, PU-6, PU-7, PU-8, PUP-1, PUP-2, PUP-3, PUP-4, PUP-5, PUP-6, PUP-7, PUP-8, PUP-9, PL-1, PL-2, PL-3, PL-4, PL-5, PL-6, PL-7, CMP-2, CMP-3, CMP-4, CMP-5, RN-3, AS-2, AS-3, AS-6, AS-7, NFR-2, NFR-3 **Success Criteria** (what must be TRUE):

1. `install <plugin>@<marketplace>` consults the cached manifest only (NO network sync, asymmetric with `update`), stages skills/prompts → agents → MCP in order, commits state last, and rolls back earlier phases on any phase failure with `(rollback partial: [<phase>] <msg>; …)` aggregation; `PathContainmentError` is NEVER folded into the rollback-partial line
2. Install conflict guards run BEFORE any disk write: cross-plugin name conflicts (skill, prompt, agent) block install with one message listing every conflicting name; cross-marketplace agent ownership refuses to overwrite; `dependencies` declarations install with a manual-install warning
3. Scope semantics are explicit and tested: project-target install reads a project-scope marketplace first and falls back to user scope, user-target install rejects project-only marketplaces, and the same `<plugin>@<marketplace>` can be installed in both scopes without cross-scope conflict
4. `update` runs `syncClone` once per marketplace, computes resolved version, partitions plugins into `updated`/`unchanged`/`skipped`/`failed`, executes the 3-phase atomic swap (prepare in tmp → state-guard swap with old-resource snapshot → physical replace + soft-dep commit), aggregates phase-3a failures before phase-3b, and emits a recovery hint pointing at uninstall+install on phase-3 failure
5. `uninstall` orders correctly (skills/prompts → agents → MCP → state commit → per-plugin data dir), survives concurrent uninstall by another process via silent converge, refuses loudly when foreign content is found at an agent target file (PU-7), and emits `Run /reload to drop "<plugin>"` only when at least one resource was removed
6. Top-level `list` (no flags) shows every bucket grouped by scope; with a marketplace name shows only that marketplace; each entry shows icon (●/○/⊘), name, optional `(<version>)`, status marker, description on second indented line truncated at column 66; `upgradable` flag is set iff manifest version differs (string compare) from install record; manifest load failure shows `[warning] could not load manifest: <reason>` and STILL renders installed plugins
7. Custom component-path arrays SUPPLEMENT defaults rather than replace them (Gap 3 / COMP-01 fix vs. V1 behavior), documented in CHANGELOG as "behavior corrected vs. V1"

**Plans**: 10 plans

- [x] `05-01-PLAN.md` -- Wave 0 shared/ extensions: RECOVERY_PLUGIN_REINSTALL_PREFIX in markers.ts + 4 new error classes in errors.ts + markers-snapshot test block + errors.test.ts cases (Wave 0)
- [x] `05-02-PLAN.md` -- Wave 0 PI-14 chokepoint + architectural test: formatRollbackError PathContainmentError bypass + tests/architecture/no-orchestrator-network.test.ts (NFR-5 / PI-2 / PL-3 source-grep) (Wave 0)
- [x] `05-03-PLAN.md` -- Wave 0 D-07 COMP-01 fix: resolver ComponentPathsSchema array migration + 3 bridge discover.ts iteration with first-wins dedup + resolver-comp01.test.ts fixtures + pluginDataDir escape tests (Wave 0)
- [x] `05-04-PLAN.md` -- Wave 1 PI-6 guard: orchestrators/plugin/shared.ts::assertNoCrossPluginConflicts (D-05) + 5-case shared.test.ts (Wave 1)
- [x] `05-05-PLAN.md` -- Wave 1 presentation: pure formatter presentation/plugin-list.ts (D-06 split; icon legend + col-66 truncation + autoupdate tag + manifest warning lines) + plugin-list.test.ts (Wave 1)
- [x] `05-06-PLAN.md` -- Wave 2 install.ts: 5-phase Phase<InstallCtx>[] ledger (D-01) + withStateGuard composition + PI-15 early sanity + post-state pluginDataDir mkdir + soft-dep + reload hint + PI-1..15 + AS-6/AS-7 tests (Wave 2)
- [x] `05-07-PLAN.md` -- Wave 2 uninstall.ts: cascadeUnstagePlugin reuse (D-09) + PU-5 silent converge + PU-7 propagation + post-state data-dir rm + PU-1..8 tests (Wave 2)
- [x] `05-08-PLAN.md` -- Wave 2 list.ts: read-only orchestrator (D-06 split; PL-1 filter union + PL-5 string compare + PL-6 manifest soft-fail + PL-7 autoupdate tag) + PL-1..7 tests + source-grep self-test (Wave 2)
- [x] `05-09-PLAN.md` -- Wave 3 update.ts: paired updateSinglePlugin (PluginUpdateFn) + updatePlugins (PUP-1 three forms) + hand-rolled 3-phase swap (D-03) + RECOVERY_PLUGIN_REINSTALL_PREFIX (D-04) + syncCloneOnce memo + PUP-9 cascade/direct routing + WR-04 fields + orchestrators/plugin/index.ts barrel + orchestrators/index.ts extension + PUP-1..9 tests (Wave 3)
- [x] `05-10-PLAN.md` -- Wave 4 documentation supersession: REQUIREMENTS.md PR-4 strikethrough + PROJECT.md D-24 row + CHANGELOG entry for COMP-01 behavior-corrected-vs-V1 (Wave 4)

### Phase 6: Edge Layer & Tab Completion

**Goal**: A Pi user can drive `/claude:plugin` end-to-end: subcommand routing with Usage blocks on empty/unknown input, quoted-argument tokenization, `--scope` validation, fish-style space normalization, and tab completion at every position with soft-fail on per-marketplace manifest errors and scope-aware install availability **Depends on**: Phase 5 **Requirements**: AP-1, AP-2, AP-3, AP-4, TC-1, TC-2, TC-3, TC-4, TC-5, TC-6, TC-7, TC-8, TC-9, CMP-6, CMP-7, CMP-8 **Success Criteria** (what must be TRUE):

1. Tab completion at the first positional after `/claude:plugin` surfaces `install / uninstall / update / list / marketplace`; after `marketplace` surfaces `add / remove / list / update / autoupdate / noautoupdate` (`rm` accepted but not surfaced); after `--scope` surfaces only `user` and `project`
2. Plugin tokens for `install/uninstall/update <here>` complete to `<plugin>@<marketplace>` form per PRD §6.6 detail rules; `install` suggests only plugins available in the current target scope and can source project-target completions from user-scope marketplaces per CMP-6..8; `update` accepts the bare `@<marketplace>` form; per-marketplace manifest-load failures soft-fail to empty set while top-level `state.json` errors propagate (no silent hide)
3. Argument parser tokenizes single- and double-quoted spaced arguments correctly, rejects missing/invalid `--scope` value with a clear error, accepts `--scope` at any position, and emits the relevant `Usage:` block at `error` severity on empty/unknown subcommand
4. All terminal completions include trailing space; double-space collapse via fish-style normalization scoped to `/claude:plugin` (does not affect other commands)
5. Every user-visible message routes through `ctx.ui.notify` via the typed wrapper from Phase 1; ESLint blocks any new `process.stdout`/`stderr` write in `src/edge/` **Plans**: 5 plans **UI hint**: yes

- [x] `06-01-test-scaffolding-PLAN.md` -- Wave 0 test scaffolding: 18 new test files under tests/edge/**/*.test.ts + tests/shared/completion-cache.test.ts with skipped stubs covering every AP-1..4 / TC-1..9 / D-02 / D-03 / D-04 behavior (Wave 0)
- [x] `06-02-edge-primitives-PLAN.md` -- Wave 1 edge primitives: port V1 args.ts + commands/_args.ts + commands/router.ts verbatim (modulo notify routing); TC-7 normalize.ts; EdgeDeps in types.ts; persistence/locations.ts cache helpers (Wave 1)
- [x] `06-03-completion-cache-and-completions-PLAN.md` -- Wave 2 two-tier cache + completion dispatcher: shared/completion-cache.ts (D-03 file + memory + ManifestSoftFailError + 10-min TTL clock seam); edge/completions/data.ts (status-aware accessors); edge/completions/provider.ts (5-branch dispatcher TC-1..6/TC-8/TC-9) (Wave 2)
- [x] `06-04-handlers-and-llm-tools-PLAN.md` -- Wave 2 handlers + LLM tools (parallel with 06-03): 9 thin-shim handlers under edge/handlers/{plugin,marketplace}/ + edge/handlers/tools.ts (D-02 two read-only LLM tools with extended params + PL-1 union semantics) (Wave 2)
- [x] `06-05-register-and-invalidation-PLAN.md` -- Wave 3 register + cache invalidation + ESLint: edge/register.ts (D-04 two registration helpers + session_start TC-7 wrapper); orchestrators/edge-deps.ts (LocationsResolver constructor; BLOCK C indirection); cache-invalidation call-sites in 5 mutating orchestrators (marketplace add/remove/update, plugin install/uninstall); eslint.config.js no-restricted-syntax rule for process.stdout/stderr in edge/ (Wave 3)

### Phase 7: Integration & Pi Wiring

**Goal**: The extension loads in a real Pi process, registers `/claude:plugin` and `resources_discover`, survives multi-process concurrency, passes a live e2e suite against `anthropics/claude-plugins-official` at a pinned SHA (PR CI) and floating main (nightly), and pins a peer-dep floor for `@mariozechner/pi-coding-agent` **Depends on**: Phase 6 **Requirements**: NFR-2, NFR-3, NFR-8, NFR-11 **Success Criteria** (what must be TRUE):

1. `index.ts` registers `/claude:plugin` command and `resources_discover` against `@mariozechner/pi-coding-agent@^0.73.1`; the `platform/pi-api.ts` wrapper makes orchestrators testable without a live Pi instance, and the wrapper surface is verified against the current `types.d.ts` (research flag from SUMMARY.md addressed)
2. A live e2e suite installs ≥3 representative plugins from `anthropics/claude-plugins-official` at a pinned SHA, exercises the soft-dep degraded path (with and without `pi-subagents` / `pi-mcp-adapter` loaded), and verifies the `Run /reload` hint causes the new resources to surface; the same suite runs nightly against floating `main` and classifies failures by mode (upstream change vs. regression)
3. A multi-process concurrency test starts two Pi processes both targeting the same scope, both running `install` simultaneously, and verifies one wins cleanly while the other rolls back with the documented "was installed concurrently" error
4. Peer dependency `@mariozechner/pi-coding-agent` declares a pinned floor (≥0.70.6 minimum, ideally ≥0.73.1 if no breaking change observed); package publish dry-run validates the manifest
5. Architecture verifiably supports adding manifest-mtime caching later (NFR-8 BACKLOG): a single seam exists where `marketplace.json` is read on the manifest path, isolated from orchestrator logic **Plans**: 6 plans

- [x] `07-01-PLAN.md` -- Pi API wrapper/import boundary and peer-dep floor (Wave 1)
- [x] `07-02-PLAN.md` -- NFR-8 manifest read seam and architecture test (Wave 1)
- [x] `07-03-PLAN.md` -- Real `index.ts` Pi wiring and disk-backed `resources_discover` (Wave 2)
- [x] `07-04-PLAN.md` -- Cross-process state lock and concurrent install integration test (Wave 3)
- [x] `07-05-PLAN.md` -- Pinned e2e fixtures, e2e tests, and CI/nightly workflows (Wave 4)
- [x] `07-06-PLAN.md` -- PI-15 supersession docs and validation sign-off (Wave 5)

### Phase 10: Claude Settings Import Foundation

**Goal**: A pure, testable import-planning foundation can read Claude Code settings for user/project scopes, merge base plus local override correctly, extract only true-enabled plugin refs, and resolve marketplace sources for official and extra-known marketplaces without mutating Pi state **Depends on**: Phase 7 and the separately-developed v1.1 milestone merge **Requirements**: IMP-04, IMP-05, IMP-06, IMP-07, IMP-08 **Success Criteria** (what must be TRUE):

1. Settings discovery reads the correct files per scope: user Claude settings and project `.claude/settings*.json`; missing files are treated as empty while malformed JSON reports a warning/error through the import result path rather than crashing the process.
2. Merge semantics are deterministic: `settings.local.json` overrides `settings.json`, including disabling a base `enabledPlugins["plugin@marketplace"]: true` by setting the local value to `false`.
3. Enabled-plugin extraction returns only refs whose merged value is exactly boolean `true`; malformed keys and non-true values are ignored or warned according to import policy without blocking valid refs.
4. Marketplace source planning maps `claude-plugins-official` to `anthropics/claude-plugins-official` when missing, and maps `extraKnownMarketplaces` Claude `directory` and `github.repo` sources into existing Pi source parser inputs.
5. Unit tests cover both-scope duplication: if the same plugin/marketplace is enabled in user and project Claude settings, the import plan contains one action per matching Pi scope.

**Plans**: 3 plans

- [x] `10-01-PLAN.md` -- Settings file discovery and merge model for user/project scopes with local override tests (Wave 1)
- [x] `10-02-PLAN.md` -- Enabled-plugin ref extraction and malformed/non-true entry handling (Wave 1)
- [x] `10-03-PLAN.md` -- Marketplace source planning: official built-in mapping + extraKnownMarketplaces directory/github mapping (Wave 2)

### Phase 11: Import Command Orchestration

**Goal**: A Pi user can run `/claude:plugin import [--scope user|project]` and have enabled Claude Code plugins installed into the matching Pi scopes idempotently, with missing marketplaces added first and unavailable plugins reported as warnings while valid imports continue **Depends on**: Phase 10 **Requirements**: IMP-01, IMP-02, IMP-03, IMP-09, IMP-10, IMP-11 **Success Criteria** (what must be TRUE):

1. `/claude:plugin import` is routed and documented consistently with existing commands; `--scope` accepts only `user` and `project`, may appear at any position, and omitted scope processes both scopes.
2. Import adds missing marketplaces before installing enabled plugins, skips marketplaces/plugins already present in the target scope, and preserves same-name marketplace/plugin imports in both user and project scopes when both Claude scopes enable them.
3. Import reuses existing marketplace-add and plugin-install semantics so network access, state locking, atomic staging, soft-dependency warnings, and reload hints match the underlying operations.
4. Unavailable/uninstallable enabled plugins do not abort the whole import; they are aggregated and reported at warning severity with enough context to identify `plugin@marketplace` and target scope.
5. Integration tests exercise a mixed import: official GitHub marketplace, extra-known directory marketplace, extra-known GitHub marketplace, local override disabling a base plugin, already-installed skip, and unavailable-plugin warning.

**Plans**: 3 plans

- [x] `11-01-PLAN.md` -- Import orchestrator: action execution, idempotency, per-scope state locking, warning aggregation (Wave 1)
- [x] `11-02-PLAN.md` -- Edge handler/router/completion updates for `/claude:plugin import [--scope user|project]` (Wave 2)
- [x] `11-03-PLAN.md` -- End-to-end import fixtures and validation sign-off (Wave 3)

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 10 → 11 (decimals slot in between if inserted). Phases 8 and 9 are reserved for the separately-developed v1.1 milestone; v1.2 owns Phases 10 and 11.

| Phase                                   | Plans Complete | Status      | Completed |
| --------------------------------------- | -------------- | ----------- | --------- |
| 1. Foundations & Toolchain              | 0/7            | Not started | -         |
| 2. Domain Core & Persistence Primitives | 0/6            | Not started | -         |
| 3. Resource Bridges                     | 0/TBD          | Not started | -         |
| 4. Marketplace Orchestrators            | 10/10          | Complete    | 2026-05-10 |
| 5. Plugin Orchestrators                 | 10/10          | Complete    | 2026-05-11 |
| 6. Edge Layer & Tab Completion          | 0/5            | Not started | -         |
| 7. Integration & Pi Wiring              | 6/6            | Complete    | 2026-05-11 |
| 10. Claude Settings Import Foundation   | 3/3            | Complete    | 2026-05-14 |
| 11. Import Command Orchestration        | 3/3            | Complete    | 2026-05-14 |
