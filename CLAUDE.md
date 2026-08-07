# pi-claude-marketplace

## Guidelines

### Git

- NEVER commit to the main branch.
- Branch names: `main`, `features/*`, `releases/*`. New feature branches use `features/<name>`.
- Worktrees are preferred for new feature work; create them under `.worktrees/`.
- Git commit messages and PR titles: Follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#specification). Titles must be at least 5 characters and no more than 72 characters. Body lines must be no more than 80 characters.
- Run `pre-commit run --all-files` (or `pre-commit run --files <changed files>`) **before** attempting `git commit`. Fix any failures, restage, and re-run until clean. Do not commit and recover from hook failures after the fact -- a failed pre-commit hook means the commit did NOT happen, so iterating with `--amend` is wrong (it would alter the previous commit).
- NEVER use `--no-verify` to skip the hooks.
- NEVER rebase, never rewrite history. Update branches by merging.
- When committing from inside a worktree, prefix the commit with `SKIP=trufflehog`. The trufflehog hook's auto-updater fails to spawn child processes under the worktree sandbox even though the underlying scan succeeds; running `pre-commit run trufflehog --all-files` separately (outside `git commit`) still passes and should be done before the commit to confirm the scan is clean. Do not extend `SKIP=` to other hooks.
- When writing PR descriptions, use the `humanizer` skill if available.
- Always use `--squash` when merging PRs (`gh pr merge --squash`). The repository does not allow merge commits or rebase merges.

### Versioning

Before creating a PR, offer to bump the version in `package.json` and `sonar-project.properties`, update `package-lock.json`, and succintly record changes in `CHANGELOG.md`.

<!-- GSD:project-start source:PROJECT.md -->

## Project

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artifacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artifacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list, import).

**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

### Constraints

- **Runtime:** Node >= 20.19.0 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@earendil-works/pi-coding-agent` peer dependency, pinned to `>=0.80.5` (dev `^0.83.0`); the NFR-11 floor-pinning SHOULD is now satisfied
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy (NFR-5, amended by url-source):** Network is required only for git-source `marketplace add`/`update`, and for `install`/`update`/`reinstall` of git-source plugins **on cache miss only** -- warm sha-pinned cache operations stay offline. `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations MUST NOT touch the network
- **Containment (NFR-10, re-anchored by url-source):** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`; plugin roots must resolve inside their **owning clone root** (marketplace clone for `path` sources, `plugin-clones/<key>/` for git sources)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests (NFR-6)
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr` writes forbidden in command/bridge code (IL-2). Single sanctioned `console.warn` is the load-time legacy migration save failure (IL-3)
- **No telemetry V1:** No metrics, no event sink, no analytics endpoint (IL-4)
- **English only V1:** No message catalog, no locale negotiation (IL-1)
- **Scope model:** Exactly two scopes -- `user` (`~/.pi/agent/`) and `project` (`<cwd>/.pi/`). Claude Code's `local` scope is not introduced (SC-1). Marketplace records and plugin install records are scoped independently per D-29 / CMP-1..8.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript `^6.0.3` (strict mode) - all extension source (`extensions/pi-claude-marketplace/`) and tests (`tests/`)
- YAML - Claude plugin manifests and marketplace metadata parsed via the `yaml` package
- Markdown - documentation, agent/skill/command definitions consumed as plugin artifacts

## Runtime

- Node.js `>=20.19.0` (declared in `package.json` `engines`)
- ESM-only (`"type": "module"` in `package.json`)
- `tsconfig.json` targets `ES2022`, `module`/`moduleResolution: NodeNext`, `noEmit: true` (type-checking only; no build/transpile step -- Node's native TS stripping runs `.ts` files directly)
- npm (lockfile: `package-lock.json`, present and committed)

## Frameworks

- No web/app framework -- this is a Pi extension (library-style), not a server or SPA
- `@earendil-works/pi-coding-agent` (peer dep `>=0.80.5`, dev dep `^0.83.0`) - the Pi extension host API (`ctx.ui.notify`, `resources_discover`, `session_start`, tool registration)
- `@earendil-works/pi-tui` (peer dep `*`, dev dep `^0.82.1`) - Pi terminal UI primitives
- `pi-subagents` (optional peer dep `>=0.35.0`) - soft-dependency companion extension for agent artifact rendering; degrades gracefully when absent
- `node:test` (Node's built-in test runner) - all suites under `tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction,integration,e2e}/**/*.test.ts`
- `memfs` `^4.57.2` - in-memory filesystem mocking for platform/persistence tests
- Coverage via `node --test --experimental-test-coverage` with `lcov` reporters, split into `unit`, `integration`, `e2e` reports feeding SonarCloud
- No bundler/build step -- TypeScript is type-checked only (`tsc --noEmit`); Node runs `.ts` sources natively
- `eslint` `^10.4.0` with flat config (`eslint.config.js`, ~400 lines, includes custom architecture-boundary gates)
- `prettier` `^3.8.3` for formatting
- `pre-commit` framework (`.pre-commit-config.yaml`) runs trufflehog, markdownlint, yamlfmt, gitlint, mdformat, prettier alongside the JS/TS checks

## Key Dependencies

- `isomorphic-git` `^1.38.1` - pure-JS git implementation used for marketplace clone/fetch/pull (no dependency on a `git` binary on PATH); wrapped in `extensions/pi-claude-marketplace/platform/git.ts`
- `typebox` `^1.1.38` (also a peer dep `*`) - runtime schema validation and discriminated-union modeling (e.g. `installable: true | false`)
- `write-file-atomic` `^8.0.0` - atomic JSON writes for `state.json`, `mcp.json`, `agents-index.json`
- `proper-lockfile` `^4.1.2` - cross-process file locking for `withStateGuard` concurrent-write detection
- `yaml` `^2.9.0` - parsing Claude plugin/marketplace YAML manifests
- `isomorphic-git/http/node` - the Node HTTP transport paired with `isomorphic-git` for actual network clone/fetch
- `@types/proper-lockfile`, `@types/write-file-atomic` - type definitions (dev only)

## Configuration

- No `.env` files present; no runtime environment-variable-based secrets detected in the extension itself
- `PI_CODING_AGENT_DIR` - honored to relocate the Pi user-scope agent directory (defaults to `~/.pi/agent/`)
- `TEST_CONCURRENCY` - optional env var controlling `node --test` concurrency in npm scripts
- `PI_CM_E2E_REF` - set to `pinned` or `main` in e2e test scripts to select which upstream ref the e2e suite exercises
- `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` - set by `platform/git-credential.ts` when spawning `git credential` subprocesses to force non-interactive behavior
- `tsconfig.json` - strict TypeScript compiler options (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.), includes `extensions/**/*.ts` and `tests/**/*.ts`
- `eslint.config.js` - flat ESLint config with `typescript-eslint`, `@stylistic/eslint-plugin`, `eslint-plugin-import-x`, `eslint-plugin-sonarjs`, plus project-specific architecture-boundary rules (e.g. no-shell-out, no-credential-leak, no-orchestrator-network gates enforced as tests, not lint rules)
- `.prettierrc.json` / `.prettierignore` - formatting config
- `sonar-project.properties` - SonarCloud project settings (`acolomba_pi-claude-marketplace`), coverage report paths, copy-paste-detection exclusions

## Platform Requirements

- Node `>=20.19.0`
- npm for dependency install
- `pre-commit` (Python-based framework) for the git hook pipeline
- Distributed as an npm package (`pi-claude-marketplace`) consumed as a Pi extension via `pi.extensions` in `package.json`, pointing at `./extensions/pi-claude-marketplace/index.ts`
- Runs inside a host Pi agent process (`@earendil-works/pi-coding-agent`) -- no standalone server or deployment target of its own
- Published to npm via GitHub Actions on `v*` tags (`.github/workflows/publish.yml`, `id-token: write` for npm provenance)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- `kebab-case.ts` throughout (`atomic-json.ts`, `git-failure-classifiers.ts`, `notify-context.ts`)
- Suffix conventions signal role: `*-mock.ts` (test doubles, `tests/helpers/credential-mock.ts`), `*.test.ts` (tests), `errors.ts` / `errors-bridges.ts` (typed error classes grouped by layer)
- `camelCase`, verb-first (`atomicWriteJson`, `findProviderForHost`, `loadMarketplaceManifestUncached`)
- Mock factories use `makeMock*` prefix (`makeMockCredentialOps`, `makeMockGitOps`, `makeMockDeviceFlowHttp`)
- Classifier/predicate functions use `is*`/`classify*`/`looksLike*` naming
- `camelCase`; `SCREAMING_SNAKE_CASE` for module-level constants (`GITHUB_PROVIDER`)
- `PascalCase` for interfaces, types, classes (`GitAuthProvider`, `CredentialOps`, `MockCredentialState`)
- Error classes always suffixed `Error` and always `extends Error` (see Error Handling below)

## Code Style

- Prettier config `.prettierrc` at repo root
- Run via `npm run format` / `npm run format:check`
- ESLint 10 flat config: `eslint.config.js` at repo root
- Extends `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` (full type-aware strict linting)
- Plugins: `@stylistic`, `import-x`, `sonarjs`
- Key rules:
- **Extension-scoped output discipline** (block for `extensions/pi-claude-marketplace/**/*.ts`): `no-restricted-syntax` forbids direct `process.stdout.write`/`process.stderr.write` calls -- matches project constraint IL-2 (all user-visible output via `ctx.ui.notify`)
- Ignored paths: `.claude/`, `.opencode/`, `.pi/`, `.planning/`, `build/`, `coverage/`, `dist/`, `node_modules/`, `tmp/`, `tests/live-uat/` (standalone `.mjs` UAT drivers excluded from typed tree)

## Import Organization

- `newlines-between: "always"` -- blank line between each group
- `alphabetize: { order: "asc", caseInsensitive: true }` within each group
- Type-only imports (`import type { ... }`) are grouped separately and placed last -- see `tests/shared/atomic-json.test.ts` and `tests/helpers/credential-mock.ts` for the pattern:
- Test files import production modules with explicit `.ts` extensions (ESM-native resolution, no build step for tests)
- Test-helper mocks use **type-only** imports of production types to avoid pulling runtime code into pure-mock files (see comment in `tests/helpers/credential-mock.ts`)
- None detected -- imports use relative paths (`../../extensions/pi-claude-marketplace/...`)

## Error Handling

- `extends Error`
- Sets `this.name = "<ClassName>"` in the constructor (so `error.name` matches the class name even after minification/transpilation)
- Carries typed, readonly public fields for structured data callers need (never encode structured data only in the message string)
- Has a doc comment citing the requirement/decision ID it implements (e.g. `MA-6`, `D-48-A`, `ATTR-07`)

## Logging

## Comments

- Non-obvious "why", not "what" -- see `.claude/rules/typescript-comments.md`
- Comments and test titles cite durable spec IDs (`D-NN`, `NFR-N`, `PRL-NN`, `MA-N`, `ATTR-NN`, etc.) as traceability anchors, not GSD process artifacts (no `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N` references -- these rot as planning docs are archived)
- File-level or class-level JSDoc-style block comments explain rationale, cross-references to sibling files, and behavior contracts (see `tests/helpers/credential-mock.ts` header)
- Used selectively above exported classes/functions with non-obvious behavior; not required on every export
- Format: `/** ... */` block above the declaration, often citing the implementing requirement ID inline

## Function Design

## Module Design

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component                   | Responsibility                                                                                                                               | File                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Extension factory           | Registers Pi event handlers (`resources_discover`, `session_start`), the `/claude:plugin` command, and MCP tools                             | `extensions/pi-claude-marketplace/index.ts`                                          |
| Edge router                 | Parses `/claude:plugin ...` subcommands + aliases into typed handler dispatch                                                                | `extensions/pi-claude-marketplace/edge/router.ts`                                    |
| Edge handlers               | Parse CLI args, resolve scope, call one orchestrator, no business logic                                                                      | `extensions/pi-claude-marketplace/edge/handlers/plugin/*.ts`, `.../marketplace/*.ts` |
| Orchestrators (plugin)      | 5-phase transactional install/uninstall/update/reinstall/enable-disable ledgers                                                              | `extensions/pi-claude-marketplace/orchestrators/plugin/*.ts`                         |
| Orchestrators (marketplace) | add/remove/list/info/update/autoupdate for marketplaces                                                                                      | `extensions/pi-claude-marketplace/orchestrators/marketplace/*.ts`                    |
| Orchestrators (import)      | Bulk cascade-install of an entire Claude Code `claude-plugins.json` config                                                                   | `extensions/pi-claude-marketplace/orchestrators/import/*.ts`                         |
| Orchestrators (reconcile)   | Load-time diffing of desired vs. on-disk state; drives `resources_discover` self-healing                                                     | `extensions/pi-claude-marketplace/orchestrators/reconcile/*.ts`                      |
| Bridges                     | Translate one Claude-plugin component kind (skills/commands/agents/mcp/hooks) into its Pi-native artifact via a stage/commit/unstage triplet | `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp,hooks}/*.ts`   |
| Domain                      | Pure resolution/validation logic: plugin manifest parsing, source-URL parsing, discriminated `installable` resolver, version derivation      | `extensions/pi-claude-marketplace/domain/*.ts`                                       |
| Transaction                 | Generic 5-phase do/undo ledger primitive + cross-process state-lock guard + rollback composition                                             | `extensions/pi-claude-marketplace/transaction/*.ts`                                  |
| Persistence                 | Atomic reads/writes of `state.json`, `claude-plugins.json`, `agents-index.json`; scope-rooted path bundle                                    | `extensions/pi-claude-marketplace/persistence/*.ts`                                  |
| Platform                    | Pi API typings, git operations, git-credential helper                                                                                        | `extensions/pi-claude-marketplace/platform/*.ts`                                     |
| Shared                      | Cross-cutting leaf utilities: notify, errors, path containment, atomic JSON, soft-dependency probing                                         | `extensions/pi-claude-marketplace/shared/*.ts`                                       |

## Pattern Overview

- Every mutating operation (install/uninstall/update/enable/disable) is a named 5-phase ledger (`transaction/phase-ledger.ts`) with symmetric `do`/`undo` per phase, guaranteeing all-or-nothing materialization across 5 independently-persisted subsystems (skills, commands, agents, hooks, mcp).
- A single cross-process advisory lock (`proper-lockfile`, `retries: 0`) guards the load→mutate→save critical section per scope (`transaction/with-state-guard.ts`); nesting two guards on the same lock file self-deadlocks, so guard-free "ledger body" functions (e.g. `runInstallLedger`) are extracted for reuse by callers that already hold the lock.
- Discriminated-union resolution (`installable: true | false`, extended to `installable | partially-available | unavailable`) means TypeScript enforces that non-installable plugins cannot have their `pluginRoot` read (NFR-7).
- Orchestrators never touch the network directly for `install`/`list`/`uninstall` (NFR-5); an architectural test (`tests/architecture/no-orchestrator-network.test.ts`) greps orchestrator source files for forbidden git-surface tokens.
- All user-visible output flows through `shared/notify.ts`'s `notify()` / `notifyWithContext()` -- direct `ctx.ui.notify` calls outside that file are forbidden by an ESLint rule and a grep gate.

## Layers

- Purpose: parse `/claude:plugin` CLI args, resolve scope flags, dispatch to exactly one orchestrator call
- Location: `extensions/pi-claude-marketplace/edge/`
- Contains: `router.ts` (subcommand dispatch table), `register.ts` (wires `SubcommandHandlers` from `EdgeDeps`), `handlers/plugin/*.ts`, `handlers/marketplace/*.ts`, `args.ts`/`args-schema.ts` (flag parsing), `completions/*` (tab-completion provider)
- Depends on: orchestrators/, shared/notify.ts, shared/errors.ts
- Used by: `index.ts` factory (`registerClaudePluginCommand`)
- Purpose: own the transactional business logic for install/uninstall/update/reinstall/enable-disable, marketplace lifecycle, bulk import, and load-time reconcile
- Location: `extensions/pi-claude-marketplace/orchestrators/`
- Contains: per-verb files (`install.ts`, `uninstall.ts`, ...) each paired with a `*.messaging.ts` file holding its notification-message builder; `shared.ts` per subdirectory for cross-verb helpers
- Depends on: bridges/, domain/, transaction/, persistence/, platform/ (auth only), shared/
- Used by: edge/handlers/\*, orchestrators/import/ (cascades plugin orchestrator calls), index.ts (`applyReconcile`, `updateSinglePlugin`)
- Purpose: one bridge per Claude-plugin component kind; each exposes `discover` (enumerate source artifacts + generated names), `stage`/`prepareStage*` (write into a staging dir or compute a prepared write), `commit*` (atomic rename/write into the live location), and `unstage*` (rollback removal)
- Location: `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp,hooks}/`
- Contains: kind-specific `types.ts`, `discover.ts`, `stage.ts`, `unstage.ts`, plus bridge-local helpers (e.g. `agents/frontmatter.ts`, `agents/index-mutation.ts`, `mcp/substitute.ts` for `${CLAUDE_PLUGIN_DATA}` variable substitution, `hooks/if-field/*` for the `if:` predicate compiler, `hooks/async-rewake/*` for hook-async resume state)
- Depends on: domain/ (name generation, manifest types), persistence/ (locations), shared/
- Used by: orchestrators/plugin/\* (5-phase install/uninstall ledgers)
- Purpose: pure, network-free resolution and validation of plugin/marketplace shapes -- no disk writes
- Location: `extensions/pi-claude-marketplace/domain/`
- Contains: `resolver.ts` (the discriminated `installable | partially-available | unavailable` resolver), `manifest.ts`/`manifest-cache.ts` (marketplace.json parsing + cache), `source.ts` (plugin source URL parsing: path/github/git-subdir/url), `version.ts` (hash-version derivation), `name.ts` (safe-name assertions), `plugin-root.ts`, `components/*.ts` (typebox schemas for plugin.json, hooks.json, mcp.json fragments)
- Depends on: shared/ only
- Used by: orchestrators/, bridges/
- Purpose: generic 5-phase do/undo ledger primitive and the cross-process state-lock guard
- Location: `extensions/pi-claude-marketplace/transaction/`
- Contains: `phase-ledger.ts` (`runPhases<C>`, `Phase<C>`, `RollbackPartial`), `with-state-guard.ts` (`withLockedStateTransaction`, `proper-lockfile`-backed), `rollback.ts`
- Depends on: persistence/ (state-io), shared/errors.ts
- Used by: orchestrators/plugin/*, orchestrators/marketplace/* (any operation needing atomic multi-subsystem materialization)
- Purpose: typed, scope-rooted, atomic reads/writes of every on-disk artifact the extension owns
- Location: `extensions/pi-claude-marketplace/persistence/`
- Contains: `locations.ts` (branded `ScopedLocations` bundle -- the single source of every writable path), `state-io.ts` (`state.json` load/save/migrate), `config-io.ts`/`config-merge.ts`/`config-write-back.ts` (`claude-plugins.json` / `.local.json`), `agents-index-io.ts`/`agents-index-schema.ts` (pi-subagents index file), `migrate.ts`/`migrate-config.ts` (schema-version upgrades)
- Depends on: domain/name.ts (safe-name assertion), platform/pi-api.ts (`getAgentDir`), shared/path-safety.ts
- Used by: orchestrators/, bridges/, transaction/
- Purpose: thin typed wrappers over the Pi extension API and git CLI, isolating the rest of the codebase from `@earendil-works/pi-coding-agent` and `isomorphic-git` specifics
- Location: `extensions/pi-claude-marketplace/platform/`
- Contains: `pi-api.ts` (re-exported/augmented Pi API types, `softDepStatus`, `getAgentDir`), `git.ts` (clone/fetch/checkout operations, the only place `isomorphic-git` is imported), `git-credential.ts` (device-flow/token credential helper)
- Depends on: shared/ only
- Used by: orchestrators/plugin/clone-cache.ts, orchestrators/auth-host.ts, index.ts
- Purpose: cross-cutting leaf utilities with no upward dependencies
- Location: `extensions/pi-claude-marketplace/shared/`
- Contains: `notify.ts`/`notify-context.ts`/`notify-reasons.ts` (the single sanctioned UI-output surface), `errors.ts`/`errors-bridges.ts` (typed error classes: `PluginShapeError`, `ConcurrentInstallError`, `StateLockHeldError`, `PathContainmentError`), `path-safety.ts` (`assertPathInside` chokepoint, NFR-10), `atomic-json.ts` (JSON write-file-atomic wrapper), `fs-utils.ts`, `concerns/soft-dep.ts` (`Dependency` type + companion-extension probing), `debug-log.ts`, `types.ts` (`Scope` union), `vars.ts` (`${CLAUDE_PLUGIN_DATA}`/`${CLAUDE_PROJECT_DIR}` substitution), `git-failure-classifiers.ts`, `probe-classifiers.ts`
- Depends on: nothing internal (leaf layer)
- Used by: every other layer

## Data Flow

### Primary Request Path (`/claude:plugin install <plugin>@<marketplace>`)

### Load-Time Reconcile Flow (`resources_discover`)

- Single source of truth is `<scopeRoot>/pi-claude-marketplace/state.json`, one file per scope (`user`/`project`), read/written exclusively through `persistence/state-io.ts` under the `proper-lockfile` guard
- No in-memory caching of `state.json` across calls; every orchestrator entry point re-loads it inside its own lock acquisition
- `shared/completion-cache.ts` is the sole exception -- a short-lived, explicitly-invalidated (`dropMarketplaceCache`) cache for tab-completion data, not authoritative state

## Key Abstractions

- Purpose: branded, scope-specific bundle of every writable path (`stateJsonPath`, `agentsDir`, `pluginDataDir(...)`, etc.) so a project-scope path can never be accidentally substituted into a user-scope operation
- Examples: `extensions/pi-claude-marketplace/persistence/locations.ts`
- Pattern: unique-symbol brand (`SCOPED_LOCATIONS_BRAND`) prevents hand-constructed object literals from type-checking as `ScopedLocations`; every name-derived path getter routes through `assertPathInside` (`shared/path-safety.ts`)
- Purpose: generic transactional primitive -- an ordered array of `{ name, do, undo }` phases executed in sequence; any `do` throw unwinds all prior `undo`s in reverse order
- Examples: `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`, consumed by `orchestrators/plugin/install.ts`, `uninstall.ts`, `update.ts`, `reinstall.ts`, `enable-disable.ts`
- Pattern: each orchestrator builds a literal 5-element array (`skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase`) closing over a per-call mutable context object
- Purpose: encode "can this plugin be materialized" as a type-level discriminant so consumers cannot read `pluginRoot` off a plugin that isn't installable
- Examples: `extensions/pi-claude-marketplace/domain/resolver.ts` (`ResolvedPlugin` union: `installable | partially-available | unavailable`)
- Pattern: `requireInstallable`/`requirePartialInstallable` narrow the union and throw `PluginShapeError` on the disqualified arm; TypeScript strict mode + `assertNever` enforce exhaustiveness at every switch
- Purpose: uniform per-component-kind lifecycle so the phase ledger can treat all 5 bridges symmetrically
- Examples: `bridges/skills/stage.ts` + `bridges/skills/unstage.ts`, mirrored in `commands/`, `agents/`, `mcp/`, `hooks/`
- Pattern: `prepareStage*` computes the target write (may stage into a tmp dir), `commitPrepared*` performs the atomic rename/write, `unstage*` removes by recorded name on rollback

## Entry Points

- Location: `extensions/pi-claude-marketplace/index.ts`
- Triggers: Pi's extension loader, awaited before any session event
- Responsibilities: register `resources_discover` (reconcile + resource aggregation), `session_start` (env reset), the `/claude:plugin` command, and MCP tools; register the hooks bridge event listeners
- Location: `extensions/pi-claude-marketplace/edge/router.ts` (`routeClaudePlugin`), wired by `edge/register.ts`
- Triggers: user-typed slash command in Pi
- Responsibilities: subcommand dispatch (install/uninstall/update/fetch/reinstall/list/info/pending/enable/disable/import/marketplace)
- Location: `extensions/pi-claude-marketplace/edge/handlers/tools.ts`, registered via `registerClaudeMarketplaceTools` (`edge/register.ts`)
- Triggers: LLM tool-call from within a Pi session
- Responsibilities: expose read-only marketplace/plugin query operations as callable tools

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; concurrency across separate OS processes (not threads) is what `proper-lockfile` guards against (two Pi instances editing the same scope's `state.json`)
- **Global state:** None at the module level in `extensions/pi-claude-marketplace/` proper; `shared/completion-cache.ts` holds a process-lifetime cache explicitly invalidated by mutating orchestrators
- **Circular imports:** None permitted by design -- `orchestrators/plugin/` may import `orchestrators/marketplace/shared.ts` (named exports only) but not `add.ts`/`remove.ts`/`update.ts`, per the D-11 import-boundary comment in `orchestrators/plugin/install.ts`; enforced by `eslint-plugin-import-x`'s no-cycle rule
- **Network boundary:** `orchestrators/plugin/install.ts`, `list.ts`, `uninstall.ts` MUST NOT import `platform/git.ts` or carry a `gitOps` field -- enforced by `tests/architecture/no-orchestrator-network.test.ts`, a source-grep architectural test (NFR-5)
- **Lock re-entrancy:** `proper-lockfile` is configured `retries: 0` and is NOT re-entrant; nesting two `withLockedStateTransaction` calls on the same scope's lock file self-deadlocks (`ELOCKED` → `StateLockHeldError`) -- guard-free ledger bodies (`runInstallLedger`, etc.) exist specifically so callers that already hold the lock (e.g. `setPluginEnabled`'s enable branch) can invoke the ledger without re-acquiring

## Anti-Patterns

### Direct `ctx.ui.notify` calls outside `shared/notify.ts`

### Orchestrator files importing git/network surfaces

## Error Propagation & Rollback

- `shared/errors.ts` defines the closed set of domain errors (`PluginShapeError`, `ConcurrentInstallError`, `StateLockHeldError`, `PathContainmentError`) each carrying a structured `.shape`/`.kind` discriminant consumers can narrow on
- `resources_discover` and `session_start` handlers in `index.ts` wrap every awaited call in try/catch with a final notify-in-catch, and the notify call itself is wrapped again -- a throw must NEVER propagate past these two Pi lifecycle events (NFR-2)
- Rollback failures during ledger `undo` are captured as `RollbackPartial[]` (`transaction/phase-ledger.ts`) and surfaced in the failure notification rather than swallowed silently

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Path                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| simple-english | \| Write or rewrite technical text with the rules of ASD-STE100 Simplified Technical English so it is clear, unambiguous, and free of AI slop. Use for documentation, READMEs, runbooks, procedures, error messages, release notes, incident reports, and API guides. Also use when the user says "STE", "Simplified Technical English", "ASD-STE100", "de-slop", "make this readable", "write for non-native readers", or asks for docs that translate well. Enforces the standard's 53 rules: 20/25-word sentence limits, one word one meaning, simple tenses, active voice, condition before command. | `.claude/skills/simple-english/SKILL.md` |

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Generated by GSD on 2026-05-14T01:19:44Z. This section is managed by `generate-claude-profile` -- do not edit manually. Full profile: `.pi/gsd/USER-PROFILE.md`

### Quick Reference

- **Communication Style (terse-direct, HIGH):** Respond directly and efficiently, leading with the answer or action before adding any optional context.
- **Decision Speed (deliberate-informed, HIGH):** Present concise trade-offs and a clear recommendation, then wait for or invite a decision when the choice has meaningful consequences.
- **Explanation Depth (detailed, HIGH):** Explain the reasoning and mechanics behind changes, but keep the explanation tightly focused on the specific question.
- **Debugging Approach (hypothesis-driven, MEDIUM):** Treat debugging as a reasoning session: state the suspected root cause, validate or refute the developer's hypothesis, and show why the fix changes the failure mode.
- **UX Philosophy (backend-focused, MEDIUM):** Prioritize correct behavior, clear data flow, and maintainable implementation; keep UI work simple and functional unless the developer asks for polish.
- **Vendor Philosophy (pragmatic-fast, MEDIUM):** Choose practical, working dependencies and integration paths first, and call out risks or alternatives only when they affect correctness, maintenance, or compatibility.
- **Frustration Triggers (instruction-adherence, LOW):** Follow the stated requirement precisely, avoid unnecessary deviations, and explicitly verify that proposed changes satisfy the user's intended constraint.
- **Learning Style (guided, HIGH):** Guide the developer through unfamiliar concepts with concise explanations and concrete examples tied directly to the current code or tool.

<!-- GSD:profile-end -->
