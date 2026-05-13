# Phase 07: Integration & Pi Wiring - Research

**Researched:** 2026-05-11
**Domain:** Pi extension API wiring, Node/TypeScript live integration testing, cross-process file locking
**Confidence:** HIGH for Pi API and lock surface; MEDIUM for Pi-runtime smoke fallback

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### E2E Suite Architecture (D-01)

- **D-01a (Idiomatic layout):** New `tests/e2e/` directory excluded from the default unit-test glob. Two CI workflow files: `.github/workflows/ci.yml` (always-on PR; runs `npm test` + `npm run test:integration` + `npm run test:e2e` in pinned-SHA mode) and `.github/workflows/e2e-nightly.yml` (cron schedule + workflow_dispatch; runs `npm run test:e2e:nightly` against floating-main). Pinned SHA stored as a code constant in `tests/e2e/_pinned-sha.ts` -- auditable in git history, refresh-via-PR. Network: anonymous public GitHub by default; fall back to `GITHUB_TOKEN` only if rate-limited.
- **D-01b (Target plugin selection):** Hand-pick 4 plugins from `anthropics/claude-plugins-official` isolated by component kind: 1 skills-only, 1 commands-only, 1 agents-only, 1 mcp-only. Combos secondary. Plugin names + rationale documented in `tests/e2e/_targets.ts`. **2x2 soft-dep matrix** (`{pi-subagents loaded, unloaded}` × `{pi-mcp-adapter loaded, unloaded}`) runs against the agents-only and mcp-only plugins -- the other two plugins run once each. If upstream lacks single-kind plugins at the pinned SHA, fall back to minimal-overlap selection and document the deviation in `_targets.ts`.
- **D-01c (Failure classification via snapshot diff):** Suite stores `tests/e2e/_fixtures/<sha>/marketplace.json` + per-plugin `plugin.json` snapshots at the pinned SHA. Nightly run: fetch fresh manifest, diff against snapshot. **Non-empty diff AND test fails → "upstream change"** (warning, no auto-block, workflow status amber/warning). **Empty diff AND test fails → "regression"** (red, workflow fails). Pinned-SHA PR runs always must pass.
- **D-01d (Two-layer driver):** **Layer A (bulk)** -- tests import `extensions/pi-claude-marketplace/index.ts` and drive registered handlers directly with a mock `ExtensionAPI` impl that records `registerCommand`/`registerTool`/`on` calls. Real network, real disk, real orchestrators/bridges/state. Only the Pi-process shell is mocked (no TUI behavior to test). **Layer B (Pi-runtime smoke)** -- ~8 smoke tests via `@earendil-works/pi-agent-core` programmatically (NOT subprocess `pi <command>`), one per command group: install / uninstall / update / list (plugin) / marketplace {add, remove, list, update, autoupdate}. Each asserts the command runs and emits a non-error message; deeper assertions live in Layer A. Plugin verification post-install: assert `resources_discover` returns the staged paths + assert Pi-surface presence (skill/prompt/agent enumeration via agent-core). Does NOT invoke installed skill/command bodies (V1 boundary; see Deferred).
- **D-01d research flag:** `@earendil-works/pi-agent-core` (`https://github.com/earendil-works/pi/tree/main/packages/agent`) must support (a) loading extensions, (b) isolated settings root so test profiles don't leak into the developer's real `~/.pi/`, (c) programmatic slash-command dispatch + registered-tool enumeration. **Fall back to subprocess `pi <command>` with `HOME` override if any of these is missing.** Phase researcher confirms before planning the smoke layer's exact test taxonomy.

#### platform/pi-api.ts Wrapper (D-02, D-03, D-04, D-05)

- **D-02 (Thin typed re-export + soft-dep helpers, NOT a full adapter class):** `platform/pi-api.ts` is a re-export shim plus the existing soft-dep helpers moved here. No adapter class. Orchestrators continue to accept `ExtensionCommandContext` / `ExtensionContext` directly -- they just import the type from `platform/pi-api.ts` instead of from the peer dep. Satisfies ROADMAP SC #1's "wrapper makes orchestrators testable without a live Pi instance" claim because the wrapper is the single mock seam for test code that wants to stub Pi-API behavior.
- **D-03 (Migrate softDepStatus from presentation/ to platform/):** `softDepStatus`, `hasLoadedPiSubagents`, `hasLoadedPiMcpAdapter` move from `presentation/soft-dep.ts` to `platform/pi-api.ts` (the helpers wrap `pi.getAllTools()` which IS a platform-API concern; their home in `presentation/` was a Phase 4 placement that the wrapper now corrects). `presentation/soft-dep.ts` becomes a one-line re-export shim: `export { softDepStatus, hasLoadedPiSubagents, hasLoadedPiMcpAdapter } from "../platform/pi-api.ts"`. Phase 4/5 callsites stay green; no churn in their import statements.
- **D-04 (Tighten import boundary via ESLint):** Add `no-restricted-imports` rule to `eslint.config.js` forbidding `@mariozechner/pi-coding-agent` imports outside `platform/pi-api.ts` itself. Exception: `tests/**/*` (fixtures may construct mocks against the peer-dep types directly). All ~12 existing `import type { ... } from "@mariozechner/pi-coding-agent"` statements migrate to `import type { ... } from "../platform/pi-api.ts"` (or appropriate relative path). Single-shot migration; all imports are `import type` so the runtime impact is zero. NFR-11 audit simplifies: peer-dep version bumps touch one file.
- **D-05 (Minimal surface; YAGNI for unused):** V1 exports: `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `Tool`, `AutocompleteItem`, `resources_discover` event payload + result types (whatever the peer dep names them) + `softDepStatus` / `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter`. ~7-10 exports. Anything not currently used in the codebase is NOT exported -- add later when a callsite needs it.

#### resources_discover Wiring (D-10, D-11, D-12, D-13)

- **D-10 (Aggregator at `orchestrators/discover.ts`):** New file `orchestrators/discover.ts` exports `aggregateDiscoveredResources(userLocations, projectLocations): Promise<{skillPaths: string[], promptPaths: string[]}>`. Pure function of `ScopedLocations` (no Pi access). `index.ts`'s `pi.on("resources_discover", ...)` callback is a 3-line shim that resolves both scope's locations (via `locationsFor("user", os.homedir())` + `locationsFor("project", process.cwd())`) then calls the aggregator. Tests at `tests/orchestrators/discover.test.ts`.
- **D-11 (Disk walk over state.json):** For each scope, list subdirectories of `<scopeRoot>/pi-claude-marketplace/resources/skills/` (each subdirectory is a `<plugin>-<skill>/` with a `SKILL.md` inside; the returned path is the directory or `SKILL.md` per Pi's `resources_discover` event contract -- confirmed during research). List `*.md` files in `<scopeRoot>/pi-claude-marketplace/resources/prompts/`. Source-of-truth is disk -- if state.json is stale or a user manually deletes a file, discovery reflects reality.
- **D-12 (Error semantics: ENOENT = empty, other errors aggregate-throw):** Missing scope dir (ENOENT on the `resources/skills/` or `resources/prompts/` parent) treated as empty array silently. Any OTHER fs error per scope (EACCES, EIO, ELOOP, etc.) collected; if any scope errored, throw `AggregateResourcesDiscoverError` with `Error.cause` chain listing all per-scope errors. Matches PRD SK-5 intent.
- **D-13 (cwd captured per-call, not at registration):** The `resources_discover` callback reads `process.cwd()` at invocation time, not at registration. If the user `cd`s during a session and runs `/reload`, the new project-scope root is reflected. Matches what `/reload` semantically means (re-scan everything) and matches the Phase 6 D-04 corollary precedent (Pitfall 3 from `06-RESEARCH.md`: `process.cwd()` at registration glue is sanctioned for this exact use case).

#### Multi-Process Concurrency Safety (D-06, D-07, D-08, D-09)

- **D-06 (File lock via `proper-lockfile@^4`):** Acquire an exclusive lock on `<scopeRoot>/pi-claude-marketplace/.state-lock` BEFORE `loadState`, release AFTER `saveState`. `proper-lockfile` is the de-facto standard (npm CLI uses it), promise-native, auto-handles stale locks via heartbeat. Bridge-level atomic-rename remains the second line of defense for any race that slips through (e.g., manual `state-lock` deletion). New `dependencies` entry: `proper-lockfile@^4`. Implementation lives in `transaction/with-state-guard.ts` -- `withStateGuard` wraps its load/save in `lock()` / `unlock()` calls. Callers (orchestrators) are unchanged -- the locking is transparent.
- **D-07 (Fail-fast lock acquisition, no wait):** `proper-lockfile` config: `retries: 0`. On lock-held: throw immediately with the `STATE_LOCK_HELD_PREFIX` marker + a "retry" hint. Matches PRD ES-2 (`error` severity = state unchanged). Better UX in interactive Pi than a blocked terminal.
- **D-08 (New marker `STATE_LOCK_HELD_PREFIX`; supersede PI-15's "was installed concurrently"):** Add `STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for"` to `shared/markers.ts` + a `markers-snapshot.test.ts` case asserting prefix-equivalence (Phase 1 B-4 pattern). The orchestrator catches lock-acquisition failure (`StateLockHeldError` from `shared/errors.ts`) and throws with this prefix + the scope name. PRD PI-15's "was installed concurrently" string is SUPERSEDED for V1 because the lock prevents the race from ever reaching the state-guard commit -- the loser fails at lock acquisition, never enters the install flow at all. Supersession recorded in REQUIREMENTS.md (PI-15 strikethrough + "(superseded by Phase 7 D-08)") and PROJECT.md Key Decisions table (new row, D-25 in project-wide numbering). Mirrors Phase 1 D-21 (MA-7), Phase 4 D-23 (MU-2/MU-3), Phase 5 D-24 (PR-4) supersession patterns.
- **D-09 (Per-scope lock granularity):** Lockfile at `<scopeRoot>/pi-claude-marketplace/.state-lock`. User scope and project scope locks are INDEPENDENT -- two processes installing into different scopes do not block each other. Read-only operations (`marketplace list`, `plugin list`, completion-cache reads) do NOT acquire the lock; they read fresh state and tolerate the possibility that the state mutates between their load and their notify -- they were already structured that way (no withStateGuard wrap). Matches Phase 2 D-10 per-scope independence.

#### NFR-8 Manifest Read Seam (D-14)

- **D-14 (Single chokepoint in `domain/manifest.ts`; verified by architecture test):** No new code module. The existing `domain/manifest.ts::loadMarketplaceManifest` is already the single chokepoint where `marketplace.json` is read on the manifest path. Phase 7 ships an architecture test at `tests/architecture/manifest-read-seam.test.ts` asserting no other module performs `readFile`/`fs.readFile`-pattern reads against a `marketplace.json` path. This proves a future caching layer can wrap `loadMarketplaceManifest` without orchestrator changes. Satisfies ROADMAP SC #5. NFR-8 itself (the cache implementation) stays Backlog -- the seam is the contract.

#### Multi-Process Concurrency Test (D-15)

- **D-15 (Single test in `tests/integration/concurrent-install.test.ts`):** Use `node:child_process.fork` to spawn two real Node processes against a shared tmpdir scope (a fresh `PI_SCOPE_ROOT_OVERRIDE` env var per test). Two cases: (a) same-plugin race -- both children try to install the same plugin; assert one succeeds with state recording the install and the other fails with `STATE_LOCK_HELD_PREFIX` (or, less commonly, a bridge-level ENOTEMPTY error if the loser gets past lock acquisition somehow -- shouldn't happen with the lock, but the test tolerates it as still-correct behavior). (b) different-plugin same-scope race -- both children try to install different plugins to the same marketplace; assert one succeeds and the other fails with `STATE_LOCK_HELD_PREFIX`; state.json contains EXACTLY ONE plugin record; no orphan resources on disk (verify by listing the resources dirs and matching against state). Test cost: ~1-2s. Covers ROADMAP SC #3 with the D-08-revised contract.

#### Peer-Dep Floor (D-16)

- **D-16 (Pin floor at `>=0.73.1` if surface verification clears; else stay at `>=0.70.6`):** During planning, the researcher verifies the `platform/pi-api.ts` surface against `@mariozechner/pi-coding-agent@^0.73.1`'s `dist/core/extensions/types.d.ts`. If every export survives without a signature change between 0.70.6 and 0.73.1, bump the peer-dep floor to `>=0.73.1`. Otherwise leave at `>=0.70.6` and document the unverified delta as a follow-up. `package.json` change. `npm pack` dry-run added as a CI step in `.github/workflows/ci.yml` to validate the published manifest cleanly. Closes NFR-11.

### the agent's Discretion

The user signed off on the recommended option for every locked decision above. Areas explicitly delegated:

- **D-01 SHA refresh policy:** Dependabot-style automation vs. manual PR vs. scheduled bump. Planning picks. Default: manual PR; reconsider if pinned SHA grows stale.
- **D-01 tmpdir isolation strategy, GITHUB_TOKEN handling, retry/timeout posture:** Planning picks per idiomatic Node test conventions.
- **D-04 ESLint rule exact pattern + exception list:** Planning picks the precise glob; default exempts `platform/pi-api.ts` itself + `tests/**/*` + `extensions/pi-claude-marketplace/index.ts` (if it imports for the `ExtensionAPI` parameter type).
- **D-06 `proper-lockfile` configuration details:** Heartbeat interval, stale detection timeout, retry algorithm shape -- planning picks per the library's recommended defaults. Default: `retries: 0` (fail-fast per D-07), `stale: 10000` (10s stale-detection -- handles a crashed Pi that left the lockfile), `update: 2000` (2s heartbeat).
- **D-09 read-only operations + lock:** Confirmed no-lock for `list` and completion-cache reads; planner adds a test that asserts these don't deadlock if invoked while another process holds the lock.
- **D-10 aggregator dedup semantics:** If both user and project scopes contain a same-named skill (unusual; possible via state-vs-disk drift), the disk-walk returns both paths -- the consumer (Pi) decides precedence. No dedup at the aggregator layer.
- **D-13 `index.ts` callback shape:** Planning picks whether the callback is `async () => aggregateDiscoveredResources(...)` or an explicit Promise chain -- both are equivalent; the former is more idiomatic.
- **NFR-8 architecture test exact assertion:** Planning picks the precise grep/AST check -- default: `import-x/no-restricted-paths` rule + an architecture test that AST-scans every `*.ts` file outside `domain/manifest.ts` for any `marketplace.json` literal in a `readFile`-call context.

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NFR-2 | No fix requires Pi restart; `/reload` suffices. [CITED: `.planning/REQUIREMENTS.md`] | `resources_discover` is an official Pi event with `reason: "startup" | "reload"`, and `ExtensionCommandContext.reload()` exists in the 0.73.1 type surface. [VERIFIED: npm tarball `@mariozechner/pi-coding-agent@0.73.1`] |
| NFR-3 | Operations are safe to retry on transient failure. [CITED: `.planning/REQUIREMENTS.md`] | `proper-lockfile` provides cross-process exclusion with fail-fast retry semantics, and existing bridge atomic staging remains the physical rollback layer. [CITED: proper-lockfile README] [VERIFIED: codebase grep/read] |
| NFR-8 | Cache marketplace manifests with mtime invalidation later. [CITED: `.planning/REQUIREMENTS.md`] | Current code has multiple direct `readFile(...marketplace.json...)` sites; Phase 7 must consolidate manifest-path reads behind `domain/manifest.ts` and enforce with an architecture test. [VERIFIED: codebase grep] |
| NFR-11 | Declare Pi extension API as peer dep and pin a minimum version once stable. [CITED: `.planning/REQUIREMENTS.md`] | `@mariozechner/pi-coding-agent@0.73.1` is current and retains the extension types needed by this project; bump peer floor to `>=0.73.1`. [VERIFIED: npm registry] [VERIFIED: npm tarball diff/read] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- `AGENTS.md` contains memory context only and no enforceable coding, testing, or security directives beyond using the recorded project history as context. [VERIFIED: `AGENTS.md`]
- No repository-local `.claude/skills/**/SKILL.md`, `.agents/skills/**/SKILL.md`, or `rules/*.md` files were found. [VERIFIED: glob]

## Summary

Phase 7 should be planned as integration hardening, not feature design: the command router and orchestrators already exist, and the high-risk work is binding them to Pi's live extension API, adding a cross-process state lock, and making live tests deterministic. [VERIFIED: codebase read] The official `@mariozechner/pi-coding-agent@0.73.1` type surface contains `ExtensionAPI.registerCommand`, `ExtensionAPI.registerTool`, `ExtensionAPI.on("resources_discover" | "session_start", ...)`, `ResourcesDiscoverEvent`, and `ResourcesDiscoverResult`, so the peer-dep floor can move from `>=0.70.6` to `>=0.73.1`. [VERIFIED: npm tarball `@mariozechner/pi-coding-agent@0.73.1`] The same surface exists in 0.70.6 for the required exports, with additive changes in 0.73.1 not breaking Phase 7's minimal wrapper surface. [VERIFIED: npm tarball comparison]

The `@earendil-works/pi-agent-core@0.74.0` package does **not** expose extension loading, isolated Pi settings roots, slash-command dispatch, or registered-tool enumeration in its published declarations; it exposes a lower-level `Agent` class and agent-loop/types primitives. [VERIFIED: npm tarball `@earendil-works/pi-agent-core@0.74.0`] Therefore the planner should treat D-01d Layer B's `@earendil-works/pi-agent-core` path as blocked for V1 smoke tests and plan the documented fallback: subprocess `pi`/`@mariozechner/pi-coding-agent` runtime smoke with `HOME` or a Pi settings-root override isolated to a tmpdir. [VERIFIED: npm tarball] [ASSUMED]

The live e2e suite can use upstream commit `6196a61bdeece7b9889ecda1e45bd7085788ae75` as the initial pin; the official marketplace at that SHA contains local, V1-installable single-kind targets: `frontend-design` or `math-olympiad` for skills-only, `code-review` or `commit-commands` for commands-only, `code-simplifier` for agents-only, and `context7`/`asana`/`github` for MCP-only. [VERIFIED: git ls-remote] [VERIFIED: cloned `anthropics/claude-plugins-official` at HEAD] Use local-path entries only for PR e2e, because this project's V1 resolver marks non-local plugin sources unavailable. [CITED: `REQUIREMENTS.md` MM-3 and Out of Scope]

**Primary recommendation:** Implement a five-plan sequence: Pi wrapper/import migration, `index.ts` + `resources_discover`, state lock + concurrency test, live e2e/CI fixtures, and peer-dep/publish-doc closure. [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Pi extension entrypoint registration | Pi Extension Runtime | Edge layer | `index.ts` receives `ExtensionAPI` and registers command/tools/events; edge handlers stay delegated. [VERIFIED: codebase read] |
| `/claude:plugin` slash command dispatch | Edge layer | Orchestrators | `edge/register.ts` already builds handlers and calls `routeClaudePlugin`; Phase 7 only calls the registration helper. [VERIFIED: codebase read] |
| `resources_discover` path aggregation | Orchestrators | Persistence / filesystem | The event shim resolves scope locations, while the pure aggregator walks staged resource directories. [CITED: `07-CONTEXT.md`] |
| Soft-dependency probing | Platform wrapper | Presentation | `pi.getAllTools()` belongs to the Pi API boundary; warning string composition can remain re-exported for callers. [VERIFIED: codebase read] |
| Cross-process state safety | Transaction / persistence | Filesystem lock | `withStateGuard` owns load-mutate-save; the lock must surround that critical section. [VERIFIED: codebase read] [CITED: proper-lockfile README] |
| Live e2e upstream fixture management | Tests / CI | GitHub network | Tests fetch/clone pinned upstream data and compare nightly floating-main diffs. [CITED: `07-CONTEXT.md`] |
| Manifest mtime caching seam | Domain | Architecture tests | `domain/manifest.ts` should be the only manifest-path read chokepoint for future cache insertion. [VERIFIED: codebase grep] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mariozechner/pi-coding-agent` | `0.73.1` latest; published 2026-05-07. [VERIFIED: npm registry] | Pi extension API types and runtime dependency peer. [VERIFIED: npm tarball] | Provides `ExtensionAPI`, command registration, tool registration, events, and `resources_discover` types required by Phase 7. [VERIFIED: npm tarball] |
| `proper-lockfile` | `4.1.2` latest; published 2021-01-25, registry modified 2022-06-24. [VERIFIED: npm registry] | Cross-process file/directory lock around `withStateGuard`. [CITED: proper-lockfile README] | Uses atomic `mkdir`, supports local/network filesystems, mtime stale detection, heartbeat update, fail-fast retries, and `lockfilePath`. [CITED: proper-lockfile README] |
| `@types/proper-lockfile` | `4.1.4` latest; published 2023-11-07. [VERIFIED: npm registry] | TypeScript declarations for `proper-lockfile`. [VERIFIED: npm registry] | `proper-lockfile` does not ship declarations in its package root. [VERIFIED: npm tarball] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `node:test` | Node `v26.0.0` locally. [VERIFIED: local command] | Unit, integration, e2e runner. [VERIFIED: package.json] | Continue existing test style; split unit/integration/e2e scripts. [VERIFIED: package.json] |
| `node:child_process.fork` | Built into Node. [CITED: Node built-in API] | Multi-process concurrency harness. [ASSUMED] | Spawn two real Node children sharing a tmp scope root. [CITED: `07-CONTEXT.md`] |
| GitHub Actions | Existing `.github/workflows/ci.yml` expected by context. [CITED: `07-CONTEXT.md`] | PR pinned e2e and nightly floating-main jobs. [CITED: `07-CONTEXT.md`] | Use separate scripts so `npm test` remains unit-only. [CITED: `07-CONTEXT.md`] |
| `@earendil-works/pi-agent-core` | `0.74.0` latest; published 2026-05-07. [VERIFIED: npm registry] | Originally proposed programmatic Pi smoke driver. [CITED: `07-CONTEXT.md`] | Do **not** rely on it for Phase 7 smoke unless a non-declaration API is separately found; published declarations lack needed extension-runtime surfaces. [VERIFIED: npm tarball] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `proper-lockfile` | Hand-rolled lock dir | Avoid; stale detection, heartbeat, compromised lock behavior, retry semantics, and network FS considerations are already handled by `proper-lockfile`. [CITED: proper-lockfile README] |
| `@earendil-works/pi-agent-core` smoke | Subprocess Pi CLI with tmp `HOME` | Recommended fallback because the published package exposes low-level agent primitives, not extension loading/command dispatch. [VERIFIED: npm tarball] |
| AST manifest seam check | Regex scan | AST is less false-positive-prone, but a regex architecture test matches existing architecture-test style and is sufficient if scoped to `readFile` + `marketplace.json`. [VERIFIED: codebase read] [ASSUMED] |

**Installation:**

```bash
npm install proper-lockfile
npm install --save-dev @types/proper-lockfile
```

**Version verification commands run:**

```bash
npm view @mariozechner/pi-coding-agent version time --json
npm view proper-lockfile version time --json
npm view @types/proper-lockfile version time --json
npm view @earendil-works/pi-agent-core version time --json
```

## Architecture Patterns

### System Architecture Diagram

```text
Pi process loads package.json pi.extensions
  -> extensions/pi-claude-marketplace/index.ts
     -> platform/pi-api.ts type boundary
     -> registerClaudePluginCommand(pi, deps)
        -> edge/router.ts
        -> edge/handlers/*
        -> orchestrators/{marketplace,plugin}/*
        -> transaction/with-state-guard.ts
           -> proper-lockfile lock(<scopeRoot>/pi-claude-marketplace/.state-lock)
           -> loadState -> mutate -> saveState -> release
     -> registerClaudeMarketplaceTools(pi)
     -> pi.on("resources_discover", handler)
        -> locationsFor(user, os.homedir()) + locationsFor(project, process.cwd())
        -> orchestrators/discover.ts aggregateDiscoveredResources
        -> disk walk resources/{skills,prompts}
        -> ResourcesDiscoverResult { skillPaths, promptPaths }
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── index.ts                    # Pi entrypoint: event + command + tool registration
├── platform/pi-api.ts          # sole @mariozechner/pi-coding-agent import/re-export surface
├── orchestrators/discover.ts   # pure resources_discover disk aggregator
├── transaction/with-state-guard.ts # cross-process lock around load/mutate/save
└── domain/manifest.ts          # single manifest-path read seam

tests/
├── architecture/manifest-read-seam.test.ts
├── integration/concurrent-install.test.ts
└── e2e/
    ├── _pinned-sha.ts
    ├── _targets.ts
    ├── _fixtures/<sha>/
    └── *.test.ts
```

### Pattern 1: Thin Pi API Re-export Boundary

**What:** Put all direct `@mariozechner/pi-coding-agent` type imports in `platform/pi-api.ts`, then import types from the wrapper everywhere else. [CITED: `07-CONTEXT.md`]
**When to use:** Any extension module needing `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `ToolDefinition`, `ToolInfo`, `AutocompleteItem`, `ResourcesDiscoverEvent`, or `ResourcesDiscoverResult`. [VERIFIED: npm tarball]

**Example:**

```typescript
// Source: @mariozechner/pi-coding-agent@0.73.1 dist/index.d.ts and dist/core/extensions/types.d.ts
export type {
  AutocompleteItem,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
  ToolDefinition,
  ToolInfo,
} from "@mariozechner/pi-coding-agent";
```

### Pattern 2: Lock the State Critical Section, Not Each Caller

**What:** `withStateGuard` acquires the per-scope lock before `loadState` and releases it in `finally` after `saveState` or any thrown mutation/save error. [VERIFIED: codebase read] [CITED: proper-lockfile README]
**When to use:** All mutating operations already funneled through `withStateGuard`; callers should remain unchanged. [VERIFIED: codebase read]

**Example:**

```typescript
// Source: proper-lockfile README plus existing transaction/with-state-guard.ts
const release = await lockfile.lock(locations.extensionRoot, {
  lockfilePath: stateLockFile(locations),
  realpath: false,
  retries: 0,
  stale: 10_000,
  update: 2_000,
});
try {
  const fresh = await loadState(locations.extensionRoot);
  const result = await mutate(fresh);
  await saveState(locations.extensionRoot, fresh);
  return result;
} finally {
  await release();
}
```

### Pattern 3: Deterministic Upstream E2E Fixture Pin

**What:** Store the upstream SHA and fixture snapshots in git; PR e2e uses the pinned SHA, nightly uses floating `main` and classifies failures by comparing fresh upstream files to snapshots. [CITED: `07-CONTEXT.md`]
**When to use:** Every live test that depends on `anthropics/claude-plugins-official`. [CITED: `07-CONTEXT.md`]

**Recommended initial pin:** `6196a61bdeece7b9889ecda1e45bd7085788ae75`. [VERIFIED: git ls-remote]

**Recommended targets:**

| Kind | Target | Rationale |
|------|--------|-----------|
| skills-only | `frontend-design` | Local source, skills-only at inspected HEAD. [VERIFIED: cloned upstream] |
| commands-only | `code-review` | Local source, commands-only at inspected HEAD. [VERIFIED: cloned upstream] |
| agents-only | `code-simplifier` | Local source, agents-only at inspected HEAD. [VERIFIED: cloned upstream] |
| mcp-only | `context7` | Local external plugin, MCP-only at inspected HEAD. [VERIFIED: cloned upstream] |

### Anti-Patterns to Avoid

- **Direct peer imports outside `platform/pi-api.ts`:** It defeats NFR-11 auditability and makes peer-dep bumps spread across the codebase. [CITED: `07-CONTEXT.md`] [VERIFIED: codebase grep]
- **Using `@earendil-works/pi-agent-core` as if it loads Pi extensions:** Its published declarations expose `Agent`, not a Pi extension runtime. [VERIFIED: npm tarball]
- **Locking only `saveState`:** The race window is load-mutate-save; lock before `loadState` or different processes can make decisions from stale snapshots. [VERIFIED: codebase read]
- **Returning state.json records from `resources_discover`:** The locked decision is disk as source of truth, so manual file deletion or stale state must be reflected. [CITED: `07-CONTEXT.md`]
- **Letting nightly floating-main failures block as regressions without snapshot diffing:** Upstream churn must be distinguished from project regressions. [CITED: `07-CONTEXT.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-process locks | Custom mkdir + stale timestamp loop | `proper-lockfile@4.1.2` + `@types/proper-lockfile@4.1.4` | Atomic mkdir, stale mtime, heartbeat, retries, custom lockfile paths, compromised-lock handling are documented. [CITED: proper-lockfile README] |
| Pi type adapter classes | Full adapter object wrapping Pi | Thin type re-export file | Decisions lock a re-export shim, not an adapter. [CITED: `07-CONTEXT.md`] |
| Live e2e target discovery at runtime | Dynamic kind classifier in every test | Static `_targets.ts` with rationale + fixture snapshots | Static targets make PR failures reproducible and reviewable. [CITED: `07-CONTEXT.md`] |
| Manifest caching implementation | New cache in Phase 7 | Architecture seam only | Actual NFR-8 cache implementation is deferred; Phase 7 verifies a single read chokepoint. [CITED: `07-CONTEXT.md`] |
| Full Pi runtime emulator | Fake all Pi internals | Mock only `ExtensionAPI` for Layer A; subprocess Pi fallback for smoke | The extension API types are sufficient for bulk tests, while runtime smoke should use the real shell if agent-core cannot. [VERIFIED: npm tarball] [ASSUMED] |

**Key insight:** The planner should spend effort on seams and verification, not abstractions: direct helper calls already exist, and the only new runtime primitive is the state lock. [VERIFIED: codebase read]

## Common Pitfalls

### Pitfall 1: `proper-lockfile` realpath default requires the locked target to exist

**What goes wrong:** Calling `lock()` on a path that does not exist with `realpath: true` can fail before creating the lock. [CITED: proper-lockfile README]
**Why it happens:** `realpath` defaults to true and requires the file to exist. [CITED: proper-lockfile README]
**How to avoid:** Lock `locations.extensionRoot` after ensuring the extension root exists, or set `realpath: false` and pass `lockfilePath: stateLockFile(locations)`. [CITED: proper-lockfile README] [ASSUMED]
**Warning signs:** Tests pass only after state.json exists, but first install into a fresh scope fails. [ASSUMED]

### Pitfall 2: `resources_discover` handler receives event and context

**What goes wrong:** Writing `pi.on("resources_discover", async () => ...)` compiles, but ignores `event.cwd`, `event.reason`, and context. [VERIFIED: npm tarball]
**Why it happens:** The handler type is `(event, ctx) => result`; TypeScript allows fewer function parameters. [VERIFIED: npm tarball] [ASSUMED]
**How to avoid:** Intentionally choose `process.cwd()` per D-13 or use `event.cwd` if implementation validation shows Pi's event cwd is the reload-aware value; document the choice in `index.ts`. [CITED: `07-CONTEXT.md`] [VERIFIED: npm tarball]
**Warning signs:** Project-scope discovery uses the cwd from extension load, not `/reload`. [CITED: `07-CONTEXT.md`]

### Pitfall 3: `Tool` is not the exported Pi type name in 0.73.1

**What goes wrong:** Exporting `Tool` from the wrapper fails because the 0.73.1 public declarations expose `ToolDefinition` and `ToolInfo`, not a top-level `Tool` export in `dist/index.d.ts`. [VERIFIED: npm tarball]
**Why it happens:** Context used a generic name; actual Pi API names differ. [VERIFIED: npm tarball]
**How to avoid:** Export `ToolDefinition` and `ToolInfo`; if existing code expects `Tool`, alias `export type Tool = ToolDefinition`. [VERIFIED: npm tarball] [ASSUMED]
**Warning signs:** Typecheck fails in `platform/pi-api.ts` on `Tool`. [ASSUMED]

### Pitfall 4: Current manifest-path reads are scattered

**What goes wrong:** An architecture test asserting only `domain/manifest.ts` reads `marketplace.json` fails immediately. [VERIFIED: codebase grep]
**Why it happens:** Current direct reads exist in marketplace add/update, plugin install/list/update, and edge completion data paths. [VERIFIED: codebase grep]
**How to avoid:** Add `loadMarketplaceManifest(manifestPath)` to `domain/manifest.ts` and migrate manifest-path reads before enabling the architecture test. [VERIFIED: codebase grep] [ASSUMED]
**Warning signs:** `grep` finds `readFile` + `marketplace.json` outside `domain/manifest.ts`. [VERIFIED: codebase grep]

### Pitfall 5: `@earendil-works/pi-agent-core` is the wrong package for Pi extension smoke

**What goes wrong:** Planning tasks around programmatic extension loading from this package block during implementation. [VERIFIED: npm tarball]
**Why it happens:** Published declarations expose a generic agent core, while Pi extension runner APIs are in `@mariozechner/pi-coding-agent`. [VERIFIED: npm tarball]
**How to avoid:** Plan fallback smoke through the Pi CLI/runtime package with tmp `HOME`; keep Layer A as the main deterministic e2e coverage. [VERIFIED: npm tarball] [ASSUMED]
**Warning signs:** No declarations for loading extensions, dispatching slash commands, or listing registered Pi resources in `@earendil-works/pi-agent-core`. [VERIFIED: npm tarball]

## Code Examples

### `index.ts` wiring shape

```typescript
// Source: @mariozechner/pi-coding-agent@0.73.1 types + existing edge/register.ts
import { homedir } from "node:os";

import { DEFAULT_GIT_OPS } from "./orchestrators/marketplace/shared.ts";
import { updateSinglePlugin } from "./orchestrators/plugin/update.ts";
import { aggregateDiscoveredResources } from "./orchestrators/discover.ts";
import { locationsFor } from "./persistence/locations.ts";
import { registerClaudeMarketplaceTools, registerClaudePluginCommand } from "./edge/register.ts";

import type { ExtensionAPI } from "./platform/pi-api.ts";

export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  pi.on("resources_discover", async () =>
    aggregateDiscoveredResources(
      locationsFor("user", homedir()),
      locationsFor("project", process.cwd()),
    ),
  );

  registerClaudePluginCommand(pi, {
    gitOps: DEFAULT_GIT_OPS,
    pluginUpdate: updateSinglePlugin,
  });
  registerClaudeMarketplaceTools(pi);
}
```

### `resources_discover` result contract

```typescript
// Source: @mariozechner/pi-coding-agent@0.73.1 dist/core/extensions/types.d.ts
export interface ResourcesDiscoverResult {
  skillPaths?: string[];
  promptPaths?: string[];
  themePaths?: string[];
}
```

### Fail-fast lock error translation

```typescript
// Source: proper-lockfile README + Phase 7 D-08 marker decision
try {
  return await withStateGuard(locations, mutate);
} catch (error) {
  if (error instanceof StateLockHeldError) {
    throw new Error(`${STATE_LOCK_HELD_PREFIX} ${error.scope}; retry the command.`, {
      cause: error,
    });
  }
  throw error;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Peer floor `>=0.70.6` | Peer floor `>=0.73.1` | 0.73.1 published 2026-05-07. [VERIFIED: npm registry] | Minimal wrapper surface remains available; NFR-11 can close. [VERIFIED: npm tarball] |
| Intra-process only `withStateGuard` | Cross-process per-scope lock around `withStateGuard` | Phase 7 D-06. [CITED: `07-CONTEXT.md`] | Prevents last-writer-wins state/disk drift. [VERIFIED: codebase read] |
| Stub `index.ts` | Real event/command/tool registration | Phase 7 scope. [VERIFIED: codebase read] | Pi can load the extension and route real commands. [CITED: `ROADMAP.md`] |
| Scattered manifest reads | Single `domain/manifest.ts` seam | Phase 7 D-14. [CITED: `07-CONTEXT.md`] | Future mtime cache can wrap one function. [CITED: `07-CONTEXT.md`] |
| `@earendil-works/pi-agent-core` proposed smoke | Subprocess Pi fallback likely required | Research on 2026-05-11. [VERIFIED: npm tarball] | Planner should not block on missing programmatic API. [VERIFIED: npm tarball] |

**Deprecated/outdated:**

- PI-15's exact "was installed concurrently" marker is superseded by `STATE_LOCK_HELD_PREFIX` because the lock makes the loser fail before state-guard commit. [CITED: `07-CONTEXT.md`]
- The current claim in `07-CONTEXT.md` that `domain/manifest.ts::loadMarketplaceManifest` already exists is stale; the file currently contains schema/validator only, and direct manifest reads remain elsewhere. [VERIFIED: codebase read] [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Subprocess Pi CLI/runtime smoke with tmp `HOME` is a viable fallback. | Summary / Pitfalls | Planner may need to replace smoke plan with Layer A-only e2e plus a manual Pi check. |
| A2 | The recommended five-plan sequence is the right granularity. | Summary | Planner may split or merge work differently. |
| A3 | `node:child_process.fork` is the right harness for multi-process tests. | Supporting Stack | A different runner may be needed if TS execution in forked children is awkward. |
| A4 | Regex architecture test is sufficient if scoped to `readFile` + `marketplace.json`. | Alternatives | False positives/negatives may require TypeScript AST scanning. |
| A5 | `Tool = ToolDefinition` alias is acceptable if code expects `Tool`. | Pitfalls | Type alias may hide a semantic mismatch with Pi tool info objects. |

## Open Questions (RESOLVED)

1. **What exact Pi CLI command should Layer B smoke run?**
    - What we know: `@mariozechner/pi-coding-agent` exposes runtime/CLI exports and is the installed dev dependency. [VERIFIED: npm tarball] [VERIFIED: package.json]
   - Resolution: Planning must make Layer A required **and** make real Pi-runtime smoke non-optional. Plan 07-05 requires a subprocess Pi-runtime smoke with isolated `HOME` / tmp cwd when the package bin exposes a viable noninteractive command surface. If the executor's probe shows subprocess automation is not viable, validation sign-off is blocked until a manual Pi-runtime smoke gate is completed and recorded. [CITED: revision iteration 1]
   - Locked planning choice: Do not rely on `@earendil-works/pi-agent-core` for V1 smoke because research found its published API insufficient; use the subprocess Pi runtime path first, with blocking manual smoke as the fallback gate rather than treating real runtime coverage as optional. [VERIFIED: npm tarball] [CITED: `07-CONTEXT.md` D-01d]
2. **Should `resources_discover` use `event.cwd` instead of `process.cwd()`?**
    - What we know: `ResourcesDiscoverEvent` contains `cwd` and `reason`. [VERIFIED: npm tarball]
   - Resolution: Keep the locked Phase 7 context decision: use `process.cwd()` captured inside the `resources_discover` handler per D-13 unless the required live smoke proves that Pi's `event.cwd` is the stronger reload-aware source. If the smoke exposes a mismatch, record the finding before changing the source. [CITED: `07-CONTEXT.md` D-13]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Tests, TS runtime, fork harness | ✓ | `v26.0.0` local. [VERIFIED: local command] | CI remains Node 24 per project history. [CITED: `ROADMAP.md`] |
| npm | Package/version verification, scripts, `npm pack` | ✓ | `11.12.1` local. [VERIFIED: local command] | None needed. |
| git | Upstream SHA pin / fixture refresh | ✓ | `2.54.0` local. [VERIFIED: local command] | GitHub raw fetch for snapshots. [ASSUMED] |
| gh | PR/workflow inspection if needed | ✓ | `2.92.0` local. [VERIFIED: local command] | Use git/raw HTTPS. [ASSUMED] |
| GitHub network | Live e2e fixture fetch | ✓ | `git ls-remote` to upstream succeeded. [VERIFIED: git ls-remote] | `GITHUB_TOKEN` on rate limit per D-01a. [CITED: `07-CONTEXT.md`] |
| `@earendil-works/pi-agent-core` | Proposed programmatic smoke | Package exists, API insufficient | `0.74.0`. [VERIFIED: npm registry] | Subprocess Pi runtime smoke. [VERIFIED: npm tarball] [ASSUMED] |

**Missing dependencies with no fallback:** None confirmed. [VERIFIED: local commands]

**Missing dependencies with fallback:** `@earendil-works/pi-agent-core` lacks required smoke-driver API; use subprocess Pi runtime smoke or Layer A-only plus manual smoke. [VERIFIED: npm tarball] [ASSUMED]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test`; package scripts use `node --test`. [VERIFIED: package.json] |
| Config file | None for test runner. [VERIFIED: package.json] |
| Quick run command | `npm test` after narrowing unit glob. [VERIFIED: package.json] [CITED: `07-CONTEXT.md`] |
| Full suite command | `npm run check && npm run test:integration && npm run test:e2e`. [CITED: `07-CONTEXT.md`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NFR-2 | `/reload` discovers staged skills/prompts without Pi restart. [CITED: `REQUIREMENTS.md`] | e2e / smoke | `npm run test:e2e -- tests/e2e/resources-discover.test.ts` [ASSUMED] | ❌ Wave 0 |
| NFR-3 | Concurrent installs do not corrupt state or orphan resources. [CITED: `REQUIREMENTS.md`] | integration | `npm run test:integration -- tests/integration/concurrent-install.test.ts` [ASSUMED] | ❌ Wave 0 |
| NFR-8 | Manifest-path reads have one seam for future cache. [CITED: `REQUIREMENTS.md`] | architecture | `node --test tests/architecture/manifest-read-seam.test.ts` [ASSUMED] | ❌ Wave 0 |
| NFR-11 | Peer dep floor and wrapper surface compile against 0.73.1. [CITED: `REQUIREMENTS.md`] | typecheck / package | `npm run typecheck && npm pack --dry-run` [VERIFIED: package.json] | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` or the smallest touched test file. [ASSUMED]
- **Per wave merge:** `npm run check`; waves touching integration/e2e also run their dedicated script. [ASSUMED]
- **Phase gate:** `npm run check && npm run test:integration && npm run test:e2e && npm pack --dry-run`. [CITED: `07-CONTEXT.md`]

### Wave 0 Gaps

- [ ] `tests/orchestrators/discover.test.ts` -- covers `resources_discover` aggregation and SK-5 behavior. [CITED: `07-CONTEXT.md`]
- [ ] `tests/architecture/manifest-read-seam.test.ts` -- covers NFR-8 seam. [CITED: `07-CONTEXT.md`]
- [ ] `tests/integration/concurrent-install.test.ts` -- covers NFR-3 live race. [CITED: `07-CONTEXT.md`]
- [ ] `tests/e2e/_pinned-sha.ts`, `_targets.ts`, `_fixtures/<sha>/` -- covers NFR-2/NFR-11 live surface. [CITED: `07-CONTEXT.md`]
- [ ] package scripts `test:e2e`, `test:e2e:nightly`, narrowed `test`, and PR/nightly workflows. [CITED: `07-CONTEXT.md`]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | No auth/session feature in Phase 7. [CITED: `ROADMAP.md`] |
| V3 Session Management | no | Pi session lifecycle is consumed, not authenticated. [VERIFIED: npm tarball] |
| V4 Access Control | yes | Scope containment and per-scope lock boundaries prevent writes outside approved roots. [CITED: `REQUIREMENTS.md` PS-1/NFR-10] |
| V5 Input Validation | yes | Keep TypeBox validation for manifests and TypeScript strictness for Pi API. [VERIFIED: codebase read] |
| V6 Cryptography | no | No new cryptographic primitive; package uses existing hash/version behavior outside Phase 7. [CITED: `REQUIREMENTS.md` PI-7] |

### Known Threat Patterns for Phase 7 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal through discovered resource paths | Tampering | Use existing `locationsFor` / `ScopedLocations` paths and do not accept user-supplied discovery paths. [VERIFIED: codebase read] |
| Concurrent state overwrite causing state/disk drift | Tampering | `proper-lockfile` around load-mutate-save plus existing atomic writes. [CITED: proper-lockfile README] [VERIFIED: codebase read] |
| Supply-chain drift in upstream live tests | Tampering / Repudiation | Pinned SHA fixtures for PR, floating-main nightly with snapshot-diff classification. [CITED: `07-CONTEXT.md`] |
| Accidental telemetry from smoke tests | Information Disclosure | Do not invoke installed skill bodies or LLM turns; test registration and resource presence only. [CITED: `07-CONTEXT.md`] |

## Sources

### Primary (HIGH confidence)

- npm registry: `@mariozechner/pi-coding-agent@0.73.1`, `proper-lockfile@4.1.2`, `@types/proper-lockfile@4.1.4`, `@earendil-works/pi-agent-core@0.74.0`. [VERIFIED: npm registry]
- npm tarballs: `@mariozechner/pi-coding-agent@0.70.6` and `@0.73.1` `dist/core/extensions/types.d.ts` and `dist/index.d.ts`. [VERIFIED: npm tarball]
- npm tarball: `@earendil-works/pi-agent-core@0.74.0` `dist/index.d.ts` and `dist/agent.d.ts`. [VERIFIED: npm tarball]
- `proper-lockfile@4.1.2` README and package.json. [CITED: proper-lockfile README]
- Codebase reads/grep: `package.json`, `index.ts`, `edge/register.ts`, `transaction/with-state-guard.ts`, `presentation/soft-dep.ts`, `domain/manifest.ts`, `eslint.config.js`, manifest read grep, Pi peer import grep. [VERIFIED: codebase read]
- Planning docs: `07-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`. [CITED: project planning docs]

### Secondary (MEDIUM confidence)

- `anthropics/claude-plugins-official` HEAD SHA `6196a61bdeece7b9889ecda1e45bd7085788ae75` from `git ls-remote`, plus a shallow clone inspected for local single-kind targets. [VERIFIED: git ls-remote] [VERIFIED: cloned upstream]

### Tertiary (LOW confidence)

- Subprocess Pi smoke exact command shape; requires planner/implementer probe before locking. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- package versions and type surfaces were verified through npm registry and tarballs. [VERIFIED: npm registry] [VERIFIED: npm tarball]
- Architecture: HIGH -- locked decisions plus current code read identify exact seams. [CITED: `07-CONTEXT.md`] [VERIFIED: codebase read]
- Pitfalls: MEDIUM -- lock and Pi API pitfalls are verified; subprocess smoke details remain assumed. [CITED: proper-lockfile README] [VERIFIED: npm tarball] [ASSUMED]

**Research date:** 2026-05-11
**Valid until:** 2026-05-18 for Pi API/e2e targets because the upstream packages and marketplace are moving quickly. [ASSUMED]
