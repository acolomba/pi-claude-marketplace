# Phase 7: Integration & Pi Wiring - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The extension loads in a real Pi process via the `index.ts` entrypoint that wires Phase 6's `registerClaudePluginCommand(pi, deps)` + `registerClaudeMarketplaceTools(pi)` plus the real `resources_discover` event handler. Multi-process concurrency is made safe by an exclusive per-scope file lock around `withStateGuard`'s critical section. A live e2e suite runs against `anthropics/claude-plugins-official` in two layers (programmatic `index.ts`-driven bulk + small `pi-agent-core`-driven Pi-runtime smoke). A `platform/pi-api.ts` wrapper consolidates every `@mariozechner/pi-coding-agent` import behind one file so peer-dep version bumps audit cleanly. NFR-8's manifest-mtime caching seam is established (single chokepoint in `domain/manifest.ts`).

Phase 7 owns 4 v1 REQ-IDs as primary (NFR-2, NFR-3, NFR-8, NFR-11) -- of those, NFR-2/NFR-3 are primarily owned by Phase 5 per the per-phase counts table but are VERIFIED in production-like conditions by Phase 7's e2e + concurrency layers. Phase 7's primary REQ-IDs in the unique sense are NFR-8 (caching seam) and NFR-11 (peer-dep floor). Phase 7 also introduces a deliberate user-contract change superseding PRD PI-15 (see D-08 below).

Phase 7 produces:

- `extensions/pi-claude-marketplace/index.ts` -- real entrypoint (replaces Phase 1 stub). Three responsibilities: (1) `pi.on("resources_discover", handler)` where `handler` is a thin shim around `orchestrators/discover.ts`; (2) call `registerClaudePluginCommand(pi, deps)` from `edge/register.ts` with `deps: EdgeDeps` built from `DEFAULT_GIT_OPS` + `updateSinglePlugin`; (3) call `registerClaudeMarketplaceTools(pi)` from `edge/register.ts`
- `extensions/pi-claude-marketplace/orchestrators/discover.ts` -- new pure aggregator `aggregateDiscoveredResources(userLocations, projectLocations): Promise<{skillPaths: string[], promptPaths: string[]}>`. Walks `<scopeRoot>/pi-claude-marketplace/resources/{skills,prompts}/` on disk for BOTH scopes. ENOENT = empty silently; any other fs error per scope is collected into `AggregateResourcesDiscoverError` and thrown after both scopes attempted. Project-scope cwd is captured INSIDE the event handler (fresh per /reload). Tests at `tests/orchestrators/discover.test.ts`
- `extensions/pi-claude-marketplace/platform/pi-api.ts` -- new thin typed re-export module + soft-dep helpers (D-02..D-04). MINIMAL surface: `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `Tool`, `AutocompleteItem`, `resources_discover` event types + `softDepStatus` / `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter`. Moved from `presentation/soft-dep.ts` (which becomes a one-line re-export shim back to `platform/pi-api.ts`)
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` -- EXTENDED with per-scope file lock acquisition via `proper-lockfile@^4` before `loadState`, release after `saveState` (D-06..D-09). Lockfile at `<scopeRoot>/pi-claude-marketplace/.state-lock`. `retries: 0` (fail-fast). On lock-held: throw `StateLockHeldError` with the new `STATE_LOCK_HELD_PREFIX` marker
- `extensions/pi-claude-marketplace/shared/markers.ts` -- new `STATE_LOCK_HELD_PREFIX` constant + markers-snapshot test case (Phase 1 B-4 prefix-equivalence pattern). PRD PI-15's "was installed concurrently" string is superseded for V1 because the lock prevents the race from ever reaching the state-guard commit (D-08 supersession effect)
- `extensions/pi-claude-marketplace/shared/errors.ts` -- new `StateLockHeldError extends Error`
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- NO behavior change, but the file becomes the SINGLE seam where `marketplace.json` is read on the manifest path. Phase 7 verifies this with an architecture test (e.g., `tests/architecture/manifest-read-seam.test.ts`) asserting `readFile(...marketplace.json...)` appears only inside `domain/manifest.ts`. Closes NFR-8 SC #5 without shipping the cache itself
- `package.json` -- bump `peerDependencies["@mariozechner/pi-coding-agent"]` from `">=0.70.6"` to a pinned floor (`">=0.73.1"` if pi-api.ts surface verification confirms compatibility); add `proper-lockfile@^4` to `dependencies`
- `eslint.config.js` -- add `no-restricted-imports` rule forbidding `@mariozechner/pi-coding-agent` imports outside `platform/pi-api.ts`. Allowed exceptions: `platform/pi-api.ts` itself + `tests/**` (test fixtures may import directly)
- `tests/e2e/` -- new directory with: `_pinned-sha.ts` constant; `_targets.ts` 4-plugin list (skills-only, commands-only, agents-only, mcp-only) + rationale; `_fixtures/<sha>/` snapshot manifests; per-command test files; soft-dep matrix tests against agents-only + mcp-only plugins; Pi-runtime smoke layer using `@earendil-works/pi-agent-core` programmatically (one smoke per command group)
- `tests/integration/concurrent-install.test.ts` -- new multi-process concurrency test using `node:child_process.fork`. Two children install (same plugin and different plugins) against shared scope; assert one succeeds, the other fails with `STATE_LOCK_HELD_PREFIX`-marked error; state.json reflects only the winner; no orphan resources on disk
- `.github/workflows/e2e-nightly.yml` -- new workflow with cron schedule + workflow_dispatch trigger. Runs against floating-main upstream; classifies failure as "upstream change" (warning, no auto-block) or "regression" (red) by diffing fetched manifest vs `tests/e2e/_fixtures/<sha>/` snapshot
- `.github/workflows/ci.yml` -- extend to also run `npm run test:e2e` (pinned-SHA mode) and `npm run test:integration` on PR
- `package.json` scripts -- add `test:e2e` and `test:e2e:nightly` (the former uses the pinned-SHA env, the latter floating-main); default `npm test` stays unit-only via glob exclusion
- `REQUIREMENTS.md` / `PROJECT.md` -- D-08 supersession of PI-15 + (if surface verification clears) NFR-11 peer-dep floor row added to Key Decisions table

This phase ends with `npm run check` green; `npm run test:e2e` green on PR against the pinned SHA; `npm run test:e2e:nightly` runnable manually (and scheduled nightly); the integration concurrency test green; manifest read seam verified by an architecture test; package publish dry-run (`npm pack`) validating the manifest cleanly. After Phase 7, the extension is loadable in a real Pi process and the surface is multi-process-safe.

</domain>

<decisions>
## Implementation Decisions

### E2E Suite Architecture (D-01)

- **D-01a (Idiomatic layout):** New `tests/e2e/` directory excluded from the default unit-test glob. Two CI workflow files: `.github/workflows/ci.yml` (always-on PR; runs `npm test` + `npm run test:integration` + `npm run test:e2e` in pinned-SHA mode) and `.github/workflows/e2e-nightly.yml` (cron schedule + workflow_dispatch; runs `npm run test:e2e:nightly` against floating-main). Pinned SHA stored as a code constant in `tests/e2e/_pinned-sha.ts` -- auditable in git history, refresh-via-PR. Network: anonymous public GitHub by default; fall back to `GITHUB_TOKEN` only if rate-limited.
- **D-01b (Target plugin selection):** Hand-pick 4 plugins from `anthropics/claude-plugins-official` isolated by component kind: 1 skills-only, 1 commands-only, 1 agents-only, 1 mcp-only. Combos secondary. Plugin names + rationale documented in `tests/e2e/_targets.ts`. **2x2 soft-dep matrix** (`{pi-subagents loaded, unloaded}` × `{pi-mcp-adapter loaded, unloaded}`) runs against the agents-only and mcp-only plugins -- the other two plugins run once each. If upstream lacks single-kind plugins at the pinned SHA, fall back to minimal-overlap selection and document the deviation in `_targets.ts`.
- **D-01c (Failure classification via snapshot diff):** Suite stores `tests/e2e/_fixtures/<sha>/marketplace.json` + per-plugin `plugin.json` snapshots at the pinned SHA. Nightly run: fetch fresh manifest, diff against snapshot. **Non-empty diff AND test fails → "upstream change"** (warning, no auto-block, workflow status amber/warning). **Empty diff AND test fails → "regression"** (red, workflow fails). Pinned-SHA PR runs always must pass.
- **D-01d (Two-layer driver):** **Layer A (bulk)** -- tests import `extensions/pi-claude-marketplace/index.ts` and drive registered handlers directly with a mock `ExtensionAPI` impl that records `registerCommand`/`registerTool`/`on` calls. Real network, real disk, real orchestrators/bridges/state. Only the Pi-process shell is mocked (no TUI behavior to test). **Layer B (Pi-runtime smoke)** -- ~8 smoke tests via `@earendil-works/pi-agent-core` programmatically (NOT subprocess `pi <command>`), one per command group: install / uninstall / update / list (plugin) / marketplace {add, remove, list, update, autoupdate}. Each asserts the command runs and emits a non-error message; deeper assertions live in Layer A. Plugin verification post-install: assert `resources_discover` returns the staged paths + assert Pi-surface presence (skill/prompt/agent enumeration via agent-core). Does NOT invoke installed skill/command bodies (V1 boundary; see Deferred).
- **D-01d research flag:** `@earendil-works/pi-agent-core` (`https://github.com/earendil-works/pi/tree/main/packages/agent`) must support (a) loading extensions, (b) isolated settings root so test profiles don't leak into the developer's real `~/.pi/`, (c) programmatic slash-command dispatch + registered-tool enumeration. **Fall back to subprocess `pi <command>` with `HOME` override if any of these is missing.** Phase researcher confirms before planning the smoke layer's exact test taxonomy.

### platform/pi-api.ts Wrapper (D-02, D-03, D-04, D-05)

- **D-02 (Thin typed re-export + soft-dep helpers, NOT a full adapter class):** `platform/pi-api.ts` is a re-export shim plus the existing soft-dep helpers moved here. No adapter class. Orchestrators continue to accept `ExtensionCommandContext` / `ExtensionContext` directly -- they just import the type from `platform/pi-api.ts` instead of from the peer dep. Satisfies ROADMAP SC #1's "wrapper makes orchestrators testable without a live Pi instance" claim because the wrapper is the single mock seam for test code that wants to stub Pi-API behavior.
- **D-03 (Migrate softDepStatus from presentation/ to platform/):** `softDepStatus`, `hasLoadedPiSubagents`, `hasLoadedPiMcpAdapter` move from `presentation/soft-dep.ts` to `platform/pi-api.ts` (the helpers wrap `pi.getAllTools()` which IS a platform-API concern; their home in `presentation/` was a Phase 4 placement that the wrapper now corrects). `presentation/soft-dep.ts` becomes a one-line re-export shim: `export { softDepStatus, hasLoadedPiSubagents, hasLoadedPiMcpAdapter } from "../platform/pi-api.ts"`. Phase 4/5 callsites stay green; no churn in their import statements.
- **D-04 (Tighten import boundary via ESLint):** Add `no-restricted-imports` rule to `eslint.config.js` forbidding `@mariozechner/pi-coding-agent` imports outside `platform/pi-api.ts` itself. Exception: `tests/**/*` (fixtures may construct mocks against the peer-dep types directly). All ~12 existing `import type { ... } from "@mariozechner/pi-coding-agent"` statements migrate to `import type { ... } from "../platform/pi-api.ts"` (or appropriate relative path). Single-shot migration; all imports are `import type` so the runtime impact is zero. NFR-11 audit simplifies: peer-dep version bumps touch one file.
- **D-05 (Minimal surface; YAGNI for unused):** V1 exports: `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `Tool`, `AutocompleteItem`, `resources_discover` event payload + result types (whatever the peer dep names them) + `softDepStatus` / `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter`. ~7-10 exports. Anything not currently used in the codebase is NOT exported -- add later when a callsite needs it.

### resources_discover Wiring (D-10, D-11, D-12, D-13)

- **D-10 (Aggregator at `orchestrators/discover.ts`):** New file `orchestrators/discover.ts` exports `aggregateDiscoveredResources(userLocations, projectLocations): Promise<{skillPaths: string[], promptPaths: string[]}>`. Pure function of `ScopedLocations` (no Pi access). `index.ts`'s `pi.on("resources_discover", ...)` callback is a 3-line shim that resolves both scope's locations (via `locationsFor("user", os.homedir())` + `locationsFor("project", process.cwd())`) then calls the aggregator. Tests at `tests/orchestrators/discover.test.ts`.
- **D-11 (Disk walk over state.json):** For each scope, list subdirectories of `<scopeRoot>/pi-claude-marketplace/resources/skills/` (each subdirectory is a `<plugin>-<skill>/` with a `SKILL.md` inside; the returned path is the directory or `SKILL.md` per Pi's `resources_discover` event contract -- confirmed during research). List `*.md` files in `<scopeRoot>/pi-claude-marketplace/resources/prompts/`. Source-of-truth is disk -- if state.json is stale or a user manually deletes a file, discovery reflects reality.
- **D-12 (Error semantics: ENOENT = empty, other errors aggregate-throw):** Missing scope dir (ENOENT on the `resources/skills/` or `resources/prompts/` parent) treated as empty array silently. Any OTHER fs error per scope (EACCES, EIO, ELOOP, etc.) collected; if any scope errored, throw `AggregateResourcesDiscoverError` with `Error.cause` chain listing all per-scope errors. Matches PRD SK-5 intent.
- **D-13 (cwd captured per-call, not at registration):** The `resources_discover` callback reads `process.cwd()` at invocation time, not at registration. If the user `cd`s during a session and runs `/reload`, the new project-scope root is reflected. Matches what `/reload` semantically means (re-scan everything) and matches the Phase 6 D-04 corollary precedent (Pitfall 3 from `06-RESEARCH.md`: `process.cwd()` at registration glue is sanctioned for this exact use case).

### Multi-Process Concurrency Safety (D-06, D-07, D-08, D-09)

**Background:** The current `withStateGuard` is documented as intra-process only ("load → mutate-in-memory → save" with no re-load-and-diff; ST-8/PI-15/ST-9 are caller-supplied invariants checked against the once-loaded snapshot). Cross-process races are real for different-plugin same-marketplace installs: both processes pass intra-process "already installed" checks against their independently-loaded snapshots, both bridges succeed (different generated names → no rename collision), both save state.json -- one overwrites the other, leaving orphan resources on disk. File-level corruption is not possible (atomic writes everywhere) but state-vs-disk drift is. Phase 7 closes this with a real cross-process lock.

- **D-06 (File lock via `proper-lockfile@^4`):** Acquire an exclusive lock on `<scopeRoot>/pi-claude-marketplace/.state-lock` BEFORE `loadState`, release AFTER `saveState`. `proper-lockfile` is the de-facto standard (npm CLI uses it), promise-native, auto-handles stale locks via heartbeat. Bridge-level atomic-rename remains the second line of defense for any race that slips through (e.g., manual `state-lock` deletion). New `dependencies` entry: `proper-lockfile@^4`. Implementation lives in `transaction/with-state-guard.ts` -- `withStateGuard` wraps its load/save in `lock()` / `unlock()` calls. Callers (orchestrators) are unchanged -- the locking is transparent.
- **D-07 (Fail-fast lock acquisition, no wait):** `proper-lockfile` config: `retries: 0`. On lock-held: throw immediately with the `STATE_LOCK_HELD_PREFIX` marker + a "retry" hint. Matches PRD ES-2 (`error` severity = state unchanged). Better UX in interactive Pi than a blocked terminal.
- **D-08 (New marker `STATE_LOCK_HELD_PREFIX`; supersede PI-15's "was installed concurrently"):** Add `STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for"` to `shared/markers.ts` + a `markers-snapshot.test.ts` case asserting prefix-equivalence (Phase 1 B-4 pattern). The orchestrator catches lock-acquisition failure (`StateLockHeldError` from `shared/errors.ts`) and throws with this prefix + the scope name. PRD PI-15's "was installed concurrently" string is SUPERSEDED for V1 because the lock prevents the race from ever reaching the state-guard commit -- the loser fails at lock acquisition, never enters the install flow at all. Supersession recorded in REQUIREMENTS.md (PI-15 strikethrough + "(superseded by Phase 7 D-08)") and PROJECT.md Key Decisions table (new row, D-25 in project-wide numbering). Mirrors Phase 1 D-21 (MA-7), Phase 4 D-23 (MU-2/MU-3), Phase 5 D-24 (PR-4) supersession patterns.
- **D-09 (Per-scope lock granularity):** Lockfile at `<scopeRoot>/pi-claude-marketplace/.state-lock`. User scope and project scope locks are INDEPENDENT -- two processes installing into different scopes do not block each other. Read-only operations (`marketplace list`, `plugin list`, completion-cache reads) do NOT acquire the lock; they read fresh state and tolerate the possibility that the state mutates between their load and their notify -- they were already structured that way (no withStateGuard wrap). Matches Phase 2 D-10 per-scope independence.

### NFR-8 Manifest Read Seam (D-14)

- **D-14 (Single chokepoint in `domain/manifest.ts`; verified by architecture test):** No new code module. The existing `domain/manifest.ts::loadMarketplaceManifest` is already the single chokepoint where `marketplace.json` is read on the manifest path. Phase 7 ships an architecture test at `tests/architecture/manifest-read-seam.test.ts` asserting no other module performs `readFile`/`fs.readFile`-pattern reads against a `marketplace.json` path. This proves a future caching layer can wrap `loadMarketplaceManifest` without orchestrator changes. Satisfies ROADMAP SC #5. NFR-8 itself (the cache implementation) stays Backlog -- the seam is the contract.

### Multi-Process Concurrency Test (D-15)

- **D-15 (Single test in `tests/integration/concurrent-install.test.ts`):** Use `node:child_process.fork` to spawn two real Node processes against a shared tmpdir scope (a fresh `PI_SCOPE_ROOT_OVERRIDE` env var per test). Two cases: (a) same-plugin race -- both children try to install the same plugin; assert one succeeds with state recording the install and the other fails with `STATE_LOCK_HELD_PREFIX` (or, less commonly, a bridge-level ENOTEMPTY error if the loser gets past lock acquisition somehow -- shouldn't happen with the lock, but the test tolerates it as still-correct behavior). (b) different-plugin same-scope race -- both children try to install different plugins to the same marketplace; assert one succeeds and the other fails with `STATE_LOCK_HELD_PREFIX`; state.json contains EXACTLY ONE plugin record; no orphan resources on disk (verify by listing the resources dirs and matching against state). Test cost: ~1-2s. Covers ROADMAP SC #3 with the D-08-revised contract.

### Peer-Dep Floor (D-16)

- **D-16 (Pin floor at `>=0.73.1` if surface verification clears; else stay at `>=0.70.6`):** During planning, the researcher verifies the `platform/pi-api.ts` surface against `@mariozechner/pi-coding-agent@^0.73.1`'s `dist/core/extensions/types.d.ts`. If every export survives without a signature change between 0.70.6 and 0.73.1, bump the peer-dep floor to `>=0.73.1`. Otherwise leave at `>=0.70.6` and document the unverified delta as a follow-up. `package.json` change. `npm pack` dry-run added as a CI step in `.github/workflows/ci.yml` to validate the published manifest cleanly. Closes NFR-11.

### Claude's Discretion

The user signed off on the recommended option for every locked decision above. Areas explicitly delegated:

- **D-01 SHA refresh policy:** Dependabot-style automation vs. manual PR vs. scheduled bump. Planning picks. Default: manual PR; reconsider if pinned SHA grows stale.
- **D-01 tmpdir isolation strategy, GITHUB_TOKEN handling, retry/timeout posture:** Planning picks per idiomatic Node test conventions.
- **D-04 ESLint rule exact pattern + exception list:** Planning picks the precise glob; default exempts `platform/pi-api.ts` itself + `tests/**/*` + `extensions/pi-claude-marketplace/index.ts` (if it imports for the `ExtensionAPI` parameter type).
- **D-06 `proper-lockfile` configuration details:** Heartbeat interval, stale detection timeout, retry algorithm shape -- planning picks per the library's recommended defaults. Default: `retries: 0` (fail-fast per D-07), `stale: 10000` (10s stale-detection -- handles a crashed Pi that left the lockfile), `update: 2000` (2s heartbeat).
- **D-09 read-only operations + lock:** Confirmed no-lock for `list` and completion-cache reads; planner adds a test that asserts these don't deadlock if invoked while another process holds the lock.
- **D-10 aggregator dedup semantics:** If both user and project scopes contain a same-named skill (unusual; possible via state-vs-disk drift), the disk-walk returns both paths -- the consumer (Pi) decides precedence. No dedup at the aggregator layer.
- **D-13 `index.ts` callback shape:** Planning picks whether the callback is `async () => aggregateDiscoveredResources(...)` or an explicit Promise chain -- both are equivalent; the former is more idiomatic.
- **NFR-8 architecture test exact assertion:** Planning picks the precise grep/AST check -- default: `import-x/no-restricted-paths` rule + an architecture test that AST-scans every `*.ts` file outside `domain/manifest.ts` for any `marketplace.json` literal in a `readFile`-call context.

### Folded Todos

None. `gsd-sdk query todo.match-phase 7` returned an empty matches array.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec (PRD)

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §5.5 -- SK-1..5 skills bridge (SK-5 `resources_discover` per-scope error aggregation)
- `docs/prd/pi-claude-marketplace-prd.md` §5.6 -- CM-1..4 commands bridge (CM-4 flat `*.md` files non-recursive)
- `docs/prd/pi-claude-marketplace-prd.md` §6.8 -- RH-3, RH-4 soft-dep probing rules (consumed by `platform/pi-api.ts::softDepStatus`)
- `docs/prd/pi-claude-marketplace-prd.md` §6.9 -- ST-1..9 state persistence (ST-7 `withStateGuard`; ST-8 concurrent install/uninstall; D-06..D-09 introduce the cross-process lock that extends ST-7's semantics)
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 -- ES-1..5 error surfaces (ES-2 severity ladder; ES-5 stable user-contract markers -- `STATE_LOCK_HELD_PREFIX` is a new ES-5 extension)
- `docs/prd/pi-claude-marketplace-prd.md` §10 -- NFR-2 (no Pi restart -- verified by e2e), NFR-3 (idempotent/fail-clean -- verified by concurrent-install test), NFR-8 (manifest mtime cache -- D-14 ships the seam), NFR-11 (peer-dep floor -- D-16 pins)
- `docs/prd/pi-claude-marketplace-prd.md` §11 -- V1 deferrals; PI-15 supersession recorded as a Phase 7 D-08 contract change

### Project planning

- `.planning/PROJECT.md` -- Key Decisions table will gain a new row (D-25 project-wide) for PI-15 supersession by Phase 7 D-08 at phase transition
- `.planning/REQUIREMENTS.md` -- Phase 7 owns NFR-8 + NFR-11; verifies NFR-2/NFR-3/NFR-5; PI-15 will be marked "(superseded by Phase 7 D-08)" at phase transition
- `.planning/ROADMAP.md` lines 159-167 -- Phase 7 goal + 5 success criteria
- `.planning/STATE.md` -- Current state; Phase 6 complete (711+ tests; D-01..D-04 shipped)
- `.planning/BACKLOG.md` -- Phase 7 surfaces (manifest cache impl, agent-core deeper integration if research blocks)

### Phase 1 carry-forward (consumed by Phase 7)

- `.planning/phases/01-foundations-toolchain/01-CONTEXT.md` -- D-03 (`write-file-atomic@^8` -- foundation under the new lock layer), D-06/D-07 (notify wrappers + ESLint output discipline), D-08 (markers as the single chokepoint for ES-5 strings; Phase 7 extends with `STATE_LOCK_HELD_PREFIX`), B-4 (prefix-equivalence pattern), D-11 (import boundaries: `platform/` may be imported by `shared/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `orchestrators/`, `edge/`; the tightened `no-restricted-imports` rule narrows the peer-dep import surface to `platform/pi-api.ts` only), D-18..20 (isomorphic-git wrapper at `platform/git.ts`; `platform/pi-api.ts` mirrors the platform-layer pattern), D-21 (MA-7 supersession precedent for Phase 7 D-08 PI-15 supersession)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- every Phase 7 user-visible message routes through `notifyError(ctx, msg, cause?)`; the lock-acquisition failure surfaces here
- `extensions/pi-claude-marketplace/shared/markers.ts` -- Phase 7 ADDS `STATE_LOCK_HELD_PREFIX` here
- `extensions/pi-claude-marketplace/shared/errors.ts` -- Phase 7 ADDS `StateLockHeldError` and `AggregateResourcesDiscoverError`
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` -- `atomicWriteJson` is the durability layer under the new lock layer

### Phase 2 carry-forward (consumed by Phase 7)

- `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md` -- D-02 (`withStateGuard` shape -- Phase 7 D-06 extends with file-lock acquisition while preserving the existing single closure-pass contract), D-09 (state shape), D-10 (per-scope independence -- justifies D-09's per-scope lock granularity)
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` -- Phase 7 D-06 EXTENDS to acquire/release `proper-lockfile` around the existing load/save sequence
- `extensions/pi-claude-marketplace/persistence/locations.ts` -- `ScopedLocations` brand. Phase 7 ADDS a `stateLockFile(loc)` helper returning `<scopeRoot>/pi-claude-marketplace/.state-lock` (containment via `assertPathInside`)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` -- `loadState`, `saveState`; Phase 7's lock layer wraps these in `withStateGuard` without changing their signatures
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- the NFR-8 caching seam; Phase 7's architecture test asserts this file is the sole `marketplace.json` reader

### Phase 3 carry-forward (consumed by Phase 7)

- `.planning/phases/03-resource-bridges/03-CONTEXT.md` -- D-04 (per-bridge atomic-apply pattern -- the second line of defense beneath the new state lock for same-target collisions)
- `extensions/pi-claude-marketplace/bridges/skills/discover.ts`, `bridges/commands/discover.ts` -- per-plugin discovery functions; NOT directly consumed by `orchestrators/discover.ts` (which walks `<scopeRoot>/pi-claude-marketplace/resources/{skills,prompts}/` on disk rather than enumerating per plugin); listed here so the planner knows the bridges' discovery layer is separate from the `resources_discover` event-handler layer

### Phase 4 carry-forward (consumed by Phase 7)

- `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` -- D-05/D-06 (`PluginUpdateFn` in `orchestrators/types.ts` -- Phase 7's `index.ts` injects Phase 5's `updateSinglePlugin` into the `EdgeDeps.pluginUpdate` field), D-12 (`GitOps` + `DEFAULT_GIT_OPS` in `orchestrators/marketplace/shared.ts` -- Phase 7's `index.ts` uses `DEFAULT_GIT_OPS` as the default for `EdgeDeps.gitOps`), D-14 (D-21 supersession precedent for Phase 7 D-08)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- `DEFAULT_GIT_OPS` import target for `index.ts`
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- `PluginUpdateFn`, `PluginUpdateOutcome`
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` -- `makeLocationsResolver`; Phase 6 D-04 created this; `index.ts` consumes via `registerClaudePluginCommand`

### Phase 5 carry-forward (consumed by Phase 7)

- `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` -- D-09 corollary (`updateSinglePlugin` is the `PluginUpdateFn` implementation Phase 7 injects), D-04 (`RECOVERY_PLUGIN_REINSTALL_PREFIX` markers extension precedent for `STATE_LOCK_HELD_PREFIX`), D-07 (PR-4 supersession precedent for Phase 7 D-08), D-08 (per-plugin data dir lifecycle -- not directly consumed but informs orphan-resources analysis in the concurrent-install test)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- exports `updateSinglePlugin: PluginUpdateFn` for `index.ts` injection

### Phase 6 carry-forward (consumed by Phase 7)

- `.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md` -- D-04 (`registerClaudePluginCommand(pi, deps)` + `registerClaudeMarketplaceTools(pi)` are Phase 7's `index.ts` call sites; `EdgeDeps` shape locked there), D-03 (completion cache; Phase 7's `index.ts` registers but the cache itself is Phase 6 deliverable), Pitfall 3 (`process.cwd()` at registration glue is sanctioned -- precedent for Phase 7 D-13's per-call cwd capture in the `resources_discover` handler)
- `extensions/pi-claude-marketplace/edge/register.ts` -- `registerClaudePluginCommand`, `registerClaudeMarketplaceTools`; Phase 7's `index.ts` calls both
- `extensions/pi-claude-marketplace/edge/types.ts` -- `EdgeDeps` interface; Phase 7 builds an instance

### Library docs (planner should pull current versions via context7)

- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `Tool`, `AutocompleteItem`, `resources_discover` event types. D-16 surface verification target.
- `proper-lockfile@^4` -- promise-native lockfile lib; `lock(file, opts) -> release`; default heartbeat + stale-detection. D-06 implementation.
- `@earendil-works/pi-agent-core` (`https://github.com/earendil-works/pi/tree/main/packages/agent`) -- Pi runtime under the TUI shell. D-01d Layer B; research-flagged for surface verification.
- `isomorphic-git` -- consumed indirectly via `platform/git.ts`; Phase 7's e2e suite exercises the real clone/fetch path.
- `node:child_process` (built-in) -- `fork()` for D-15 concurrent-install test.
- `node:fs/promises` -- `readdir`, `stat`, `mkdir({ recursive: true })` for D-11 disk walk.
- `node:os` -- `homedir()` for user-scope root in D-13.

### V1 reference (read selectively when implementing the same concern)

- `git show features/initial:extensions/pi-claude-marketplace.ts` -- V1 entrypoint; the registration shape Phase 7's `index.ts` matches (modulo Phase 6's two-helper split via `registerClaudePluginCommand` + `registerClaudeMarketplaceTools`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 1-6 outputs)

- **`extensions/pi-claude-marketplace/index.ts`** -- the Phase 1 stub returns empty `resources_discover` arrays and a "not implemented yet" warning for the slash command. Phase 7 REPLACES the stub with a 3-call entrypoint (D-10 + D-13 + Phase 6 D-04 registration).
- **`extensions/pi-claude-marketplace/edge/register.ts`** -- already exports `registerClaudePluginCommand(pi, deps)` + `registerClaudeMarketplaceTools(pi)`. Phase 7's `index.ts` calls both. No changes to `register.ts`.
- **`extensions/pi-claude-marketplace/edge/types.ts`** -- `EdgeDeps` shape locked. Phase 7's `index.ts` builds the instance from `DEFAULT_GIT_OPS` + `updateSinglePlugin`.
- **`extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`** -- `DEFAULT_GIT_OPS` already exported. Phase 7 imports.
- **`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`** -- `updateSinglePlugin: PluginUpdateFn` already exported. Phase 7 imports.
- **`extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`** -- `makeLocationsResolver` already exists; `register.ts` already calls it. No changes for Phase 7 unless the resolver needs a tweak for `resources_discover`'s per-call cwd capture (D-13).
- **`extensions/pi-claude-marketplace/transaction/with-state-guard.ts`** -- Phase 7 D-06 EXTENDS to acquire `proper-lockfile` lock before `loadState`, release after `saveState`. Caller signatures unchanged.
- **`extensions/pi-claude-marketplace/persistence/state-io.ts`** -- `loadState`, `saveState` consumed unchanged. The lock layer wraps these.
- **`extensions/pi-claude-marketplace/persistence/locations.ts`** -- Phase 7 ADDS `stateLockFile(loc: ScopedLocations): string` returning `<scopeRoot>/pi-claude-marketplace/.state-lock` (containment via `assertPathInside`).
- **`extensions/pi-claude-marketplace/domain/manifest.ts`** -- the NFR-8 seam. No code change in Phase 7; the architecture test verifies the seam.
- **`extensions/pi-claude-marketplace/presentation/soft-dep.ts`** -- Phase 7 D-03 MOVES `softDepStatus`, `hasLoadedPiSubagents`, `hasLoadedPiMcpAdapter` to `platform/pi-api.ts`. This file becomes a one-line re-export shim so Phase 4/5 callsites stay green.
- **`extensions/pi-claude-marketplace/shared/markers.ts`** -- Phase 7 ADDS `STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for"`. Markers-snapshot test gains one case.
- **`extensions/pi-claude-marketplace/shared/errors.ts`** -- Phase 7 ADDS `StateLockHeldError extends Error` (carries the scope name) and `AggregateResourcesDiscoverError extends Error` (carries the per-scope error array via `Error.cause`).
- **`tests/architecture/`** -- existing pattern: `import-boundaries.test.ts`, `markers-snapshot.test.ts`, `no-orchestrator-network.test.ts`, etc. Phase 7 ADDS `manifest-read-seam.test.ts` (D-14).
- **`tests/integration/`** -- existing dir (currently mostly empty per `npm run test:integration`). Phase 7 ADDS `concurrent-install.test.ts` (D-15).

### Established Patterns (carry forward unchanged)

- **TypeScript strict + ESM** -- All Phase 7 modules follow.
- **Import boundaries** -- Phase 7 TIGHTENS the existing `import-x/no-restricted-paths` rule with a `no-restricted-imports` addendum forbidding `@mariozechner/pi-coding-agent` outside `platform/pi-api.ts`.
- **TypeBox JIT compile at module load** -- Phase 7 does not define new schemas.
- **`npm run check` pipeline** -- typecheck + ESLint + Prettier + `node --test "tests/**/*.test.ts"` MUST stay green per NFR-6. Phase 7 extends with `test:e2e` (PR mode) and `test:e2e:nightly` (scheduled).
- **Per-phase markers extension pattern** -- Phase 1 (`RELOAD_HINT_PREFIX` etc.), Phase 5 (`RECOVERY_PLUGIN_REINSTALL_PREFIX`), Phase 7 (`STATE_LOCK_HELD_PREFIX`). Each gets a markers-snapshot test case (B-4 prefix-equivalence pattern).
- **Per-phase supersession pattern (D-21/D-23/D-24)** -- Phase 7 D-08 follows the same shape: REQUIREMENTS.md strikethrough + PROJECT.md Key Decisions row + (no CHANGELOG entry needed unless this is a user-facing string change -- which it is, so a CHANGELOG entry is appropriate).
- **PRD-as-snapshot-fixture (Phase 1 D-09)** -- `tests/helpers/prd-extract.ts`. Phase 7 may use for any new ES-5 markers (`STATE_LOCK_HELD_PREFIX` byte-for-byte against PRD if/when PRD is amended; otherwise it's a Phase 7 extension beyond ES-5 like Phase 5 D-04).
- **Pre-commit hook chain** -- unicode-dash + smartquote + mdformat + markdownlint-cli2. Avoid em-dashes in commit titles.

### Integration Points

- **`index.ts` shape:** Three responsibilities. (1) `pi.on("resources_discover", async () => aggregateDiscoveredResources(locationsFor("user", os.homedir()), locationsFor("project", process.cwd())))` -- per-call cwd per D-13. (2) `registerClaudePluginCommand(pi, { gitOps: DEFAULT_GIT_OPS, pluginUpdate: updateSinglePlugin })` from `edge/register.ts`. (3) `registerClaudeMarketplaceTools(pi)` from `edge/register.ts`. That's the entire body of `claudeMarketplaceExtension(pi)`.
- **Lock layer transparency:** `withStateGuard`'s caller signature is unchanged; orchestrators don't know about the lock. The lock acquisition happens inside `withStateGuard`'s body, before `loadState`. The release happens in a `try`/`finally` wrapping the save. Failure to acquire surfaces as `StateLockHeldError` thrown from `withStateGuard` -- propagates up through the orchestrator's normal error path; `notifyError` surfaces it; ledger rollback runs as if any other error.
- **`platform/pi-api.ts` re-export chain:** Every existing `import type { ExtensionContext } from "@mariozechner/pi-coding-agent"` migrates to `import type { ExtensionContext } from "<relative>/platform/pi-api.ts"`. Type re-exports preserve identity (TypeScript treats `export type` as nominally identical to the source). No runtime impact.
- **E2E Layer A (programmatic) consumes `index.ts` directly:** No new entrypoint needed; tests `import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts"` and instantiate it with a tiny `mockPi: ExtensionAPI` record-and-replay shim.
- **E2E Layer B (agent-core) depends on `@earendil-works/pi-agent-core`:** Added as a DEV dep, not a runtime dep. Falls back to subprocess `pi <command>` with `HOME=<tmpdir>` if agent-core's surface is insufficient (research flag in D-01d).
- **Architectural test for manifest read seam (D-14):** Scans every `.ts` file outside `domain/manifest.ts` for `readFile(...marketplace.json...)`-shaped reads. Implementation: TypeScript AST walk via `typescript` API (already a dev dep) or a simpler grep-based check via `node:fs` + `node:path` (idiomatic for architectural tests in this codebase per the existing `no-orchestrator-network.test.ts`).

</code_context>

<specifics>
## Specific Ideas

- **`tests/e2e/_targets.ts` structure:**
  ```typescript
  export interface E2ETarget {
    readonly plugin: string;
    readonly marketplace: "anthropics/claude-plugins-official";
    readonly kind: "skills" | "commands" | "agents" | "mcp";
    readonly softDepMatrix: boolean; // run 2x2 against this plugin?
    readonly rationale: string;
  }
  export const TARGETS: readonly E2ETarget[] = [
    { plugin: "...", marketplace: "anthropics/claude-plugins-official", kind: "skills", softDepMatrix: false, rationale: "..." },
    // 3 more
  ];
  ```
- **`tests/e2e/_pinned-sha.ts`:** Single export `export const PINNED_SHA = "..."` plus a comment block citing the date of the pin and the manual-refresh policy. Bumped via PR.
- **`tests/e2e/_fixtures/<sha>/`:** Directory per pinned SHA holding `marketplace.json` + per-target `plugin.json`. Snapshot files generated by a `scripts/refresh-e2e-fixtures.ts` helper that fetches the current manifest at the new SHA and writes the snapshot. Run by hand on a pin bump; never auto-run.
- **`tests/e2e/install.test.ts` taxonomy:** Per-target install + assert resources on disk + assert `resources_discover` returns staged paths + assert per-Pi-surface presence via the smoke layer. Soft-dep matrix tests on agents-only + mcp-only targets.
- **`tests/integration/concurrent-install.test.ts` taxonomy:** Two cases (same-plugin race; different-plugin same-marketplace race). Each spawns two `child_process.fork` children, awaits both, asserts one succeeds and the other surfaces `STATE_LOCK_HELD_PREFIX`-marked error. State.json post-condition: contains exactly the winner's plugin record. Disk post-condition: no orphan resources (winner's resources exist, loser's resources do not).
- **`tests/architecture/manifest-read-seam.test.ts`:** Walk every `.ts` file under `extensions/pi-claude-marketplace/` (excluding `domain/manifest.ts` and `tests/`). Assert no source-text occurrence of `marketplace.json` in a `readFile`-call context (regex-based check matching the precedent of `no-orchestrator-network.test.ts`).
- **`tests/architecture/markers-snapshot.test.ts` extension:** Add one case for `STATE_LOCK_HELD_PREFIX` -- byte-for-byte prefix equality assertion. If/when PRD is amended to include the new marker, the assertion target moves from "Phase 7 extension beyond ES-5" to "ES-5 literal."
- **`tests/orchestrators/discover.test.ts` taxonomy:** Each scope cases: (a) directory missing → empty; (b) directory empty → empty; (c) plugin staged → returns paths; (d) EACCES error → aggregated throw; (e) ELOOP (symlink loop) error → aggregated throw; (f) mixed: user scope errors, project scope succeeds → throws with both error AND project paths NOT silently dropped (the throw aggregates, so project paths surface inside the error.cause chain).
- **`tests/transaction/with-state-guard.test.ts` extension:** Add cases for (a) lock acquired, mutate runs, lock released; (b) lock held by another in-process call (simulated via `proper-lockfile.lock` already held) → throws `StateLockHeldError` immediately; (c) mutate throws → lock still released (try/finally); (d) saveState throws → lock still released.
- **Package.json scripts:**
  ```jsonc
  "test": "node --test \"tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction}/**/*.test.ts\"",
  "test:integration": "node --test \"tests/integration/**/*.test.ts\"",
  "test:e2e": "PI_CM_E2E_REF=pinned node --test \"tests/e2e/**/*.test.ts\"",
  "test:e2e:nightly": "PI_CM_E2E_REF=main node --test \"tests/e2e/**/*.test.ts\""
  ```
  Note: existing `"test"` glob is `tests/**/*.test.ts` -- Phase 7 narrows it to exclude `tests/e2e/` and `tests/integration/` so they run only via their own scripts. The `check` script remains green via `test` (unit) only; PR jobs run `test`, `test:integration`, `test:e2e` (pinned) separately.
- **D-08 supersession PR task:** Like Phase 1/4/5's supersession tasks, Phase 7's plan includes ONE task that updates REQUIREMENTS.md PI-15 with strikethrough + adds PROJECT.md Key Decisions row + adds CHANGELOG entry for the user-contract change.
- **D-16 peer-dep floor verification task:** Phase 7 plan includes one research task (during planning, not after) that diffs `@mariozechner/pi-coding-agent@0.70.6` vs `@0.73.1` `types.d.ts` for the `platform/pi-api.ts` surface. Decision: bump to `>=0.73.1` if compatible, else leave at `>=0.70.6` with a documented deferral.

</specifics>

<deferred>
## Deferred Ideas

- **Manifest mtime cache implementation (NFR-8 / PERF-01)** -- Phase 7 lands the SEAM only. The actual caching layer wrapping `loadMarketplaceManifest` is post-V1. Captured in `.planning/BACKLOG.md`.
- **`@earendil-works/pi-agent-core` deeper integration** -- if research clears the Layer-B smoke tests, future iterations could move MORE tests to the agent-core driver (currently only ~8 smoke tests). Captured in `.planning/BACKLOG.md`.
- **Subprocess `pi <command>` driver** -- Fallback only if agent-core's API surface is insufficient for V1's smoke needs. Not the primary plan.
- **Full surface via Pi binary** -- Testing every command through `pi` (vs the ~8 smoke set). Over-invests for V1.
- **Invoking installed skill/command bodies in e2e** -- Phase 7 verifies Pi-surface presence (skill/prompt/agent enumeration) but does not actually invoke the skill body. Real execution is post-V1; tests would be brittle.
- **Dependabot-style SHA refresh automation** -- Phase 7 uses manual PR refresh. Automation is a quality-of-life improvement.
- **GitHub Actions concurrency-group on e2e workflows** -- Cancel in-progress nightly when a new commit lands. Planning's call.
- **Lock-held graceful retry/queue mode** -- D-07 locks `retries: 0` (fail-fast). A future ergonomic could add a `--wait` flag to slash commands that retries the lock acquisition. Not V1.
- **Per-marketplace lock granularity** -- D-09 uses per-scope. Finer-grained (per-marketplace) would allow parallel installs into the same scope but different marketplaces. Complexity vs benefit for V1; current per-scope is sufficient.
- **Cross-process OCC inside `withStateGuard` (in addition to the lock)** -- Belt-and-suspenders. With the lock there's no race the OCC would catch. Defer.
- **Pluggable Pi-API compat shim for multiple peer-dep versions** -- V2 concern (D-04 enables a single point to add this; not needed in V1).
- **Multi-version Node CI matrix** -- ROADMAP Phase 1 SC #5 already locked to Node 24 (D-01 there). Phase 7 doesn't expand the matrix; future audit can.
- **CHANGELOG.md format adoption** -- Phase 5 D-07 introduced CHANGELOG entries; Phase 7's D-08 supersession adds one. No format change needed.
- **e2e GitHub Actions cost budget enforcement** -- if nightly runs become expensive, add a budget gate. Not V1.
- **Telemetry on lock contention rates** -- IL-4 forbids telemetry V1. The `StateLockHeldError` shape is suitable for a future IL-5 event channel.

### Reviewed Todos (not folded)

None. `gsd-sdk query todo.match-phase 7` returned an empty matches array; no reviewed-but-deferred todos.

</deferred>

---

*Phase: 7-Integration & Pi Wiring*
*Context gathered: 2026-05-11*
