# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
pi-claude-marketplace/
├── extensions/pi-claude-marketplace/   # The Pi extension source (npm package payload)
│   ├── index.ts                        # Extension factory entry point
│   ├── edge/                           # Command parsing + dispatch layer
│   │   ├── handlers/plugin/            # /claude:plugin <verb> handlers
│   │   ├── handlers/marketplace/       # /claude:plugin marketplace <verb> handlers
│   │   └── completions/                # Tab-completion provider
│   ├── orchestrators/                  # Transactional business logic
│   │   ├── plugin/                     # install/uninstall/update/reinstall/enable-disable
│   │   ├── marketplace/                # add/remove/list/info/update/autoupdate
│   │   ├── import/                     # bulk cascade-install from claude-plugins.json
│   │   └── reconcile/                  # load-time self-heal diff/apply
│   ├── bridges/                        # Claude-artifact -> Pi-artifact translators
│   │   ├── skills/ commands/ agents/   # one dir per component kind
│   │   ├── mcp/ hooks/                 # (hooks/ also owns Claude-Code hook dispatch)
│   ├── domain/                         # Pure resolution/validation, no disk writes
│   │   └── components/                 # typebox schemas (plugin.json, hooks.json, mcp)
│   ├── transaction/                    # 5-phase ledger primitive + state-lock guard
│   ├── persistence/                    # Atomic state.json / config / agents-index I/O
│   ├── platform/                       # Pi API + git wrappers
│   └── shared/                         # Cross-cutting leaf utilities (notify, errors, paths)
├── tests/                              # node:test suite, mirrors extensions/ layout
│   ├── architecture/                   # Source-grep architectural constraint tests
│   ├── domain/ persistence/ bridges/   # unit tests per layer
│   ├── orchestrators/ edge/ platform/ shared/ transaction/
│   ├── integration/ e2e/ live-uat/     # higher-level test tiers
│   ├── fixtures/ helpers/              # shared test fixtures and driver helpers
├── docs/                               # PRD and design documentation
│   └── prd/pi-claude-marketplace-prd.md  # Authoritative successor-architecture spec
├── scripts/                            # Repo maintenance scripts
├── .planning/                          # GSD planning artifacts (this document lives here)
├── .claude/                            # Claude Code plugin/skill/GSD tooling config
├── .github/workflows/                  # CI pipelines
├── demos/                              # Manual demo scripts/fixtures
├── package.json                        # npm package manifest (name: pi-claude-marketplace)
└── tsconfig.json / eslint.config.js / .prettierrc  # Toolchain config
```

## Directory Purposes

**`extensions/pi-claude-marketplace/edge/`:**
- Purpose: CLI-facing layer — parses `/claude:plugin` args, resolves `--scope`/`--local`/flags, dispatches to exactly one orchestrator call, and registers MCP tools
- Contains: `router.ts` (subcommand table), `register.ts` (wires handlers to Pi), `args.ts`/`args-schema.ts` (flag parsing), `flag-catalog.ts`, `types.ts`, `handlers/plugin/*.ts`, `handlers/marketplace/*.ts`, `completions/*.ts`
- Key files: `edge/router.ts`, `edge/register.ts`, `edge/handlers/shared.ts`

**`extensions/pi-claude-marketplace/orchestrators/`:**
- Purpose: owns every transactional mutation and its notification composition
- Contains: per-verb `*.ts` files, each paired with a `*.messaging.ts` sibling that builds the notify() payload
- Key files: `orchestrators/plugin/install.ts` (largest file, ~2400 lines, the canonical 5-phase ledger example), `orchestrators/reconcile/apply.ts` (load-time self-heal), `orchestrators/import/execute.ts` (bulk cascade)

**`extensions/pi-claude-marketplace/bridges/`:**
- Purpose: one subdirectory per Claude-plugin component kind; each exposes discover/stage/commit/unstage for that kind
- Contains: `skills/`, `commands/`, `agents/` (also `frontmatter.ts`, `index-mutation.ts`, `marker.ts` for pi-subagents index rows), `mcp/` (also `substitute.ts` for `${VAR}` expansion, `collision-slots.ts`), `hooks/` (also owns Claude-Code hook event dispatch: `dispatch.ts`, `event-router.ts`, `if-field/`, `async-rewake/`, `payloads/`)
- Key files: `bridges/hooks/index.ts` (registers Pi hook listeners), `bridges/index.ts` (barrel)

**`extensions/pi-claude-marketplace/domain/`:**
- Purpose: pure functions — resolve a plugin's installability, parse manifests/sources/versions — no I/O beyond reading already-fetched files
- Contains: `resolver.ts`, `manifest.ts`, `manifest-cache.ts`, `source.ts`, `version.ts`, `name.ts`, `plugin-root.ts`, `auth-registry.ts`, `github-auth.ts`, `clone-key.ts`, `components/*.ts` (typebox schemas)
- Key files: `domain/resolver.ts` (the `installable | partially-available | unavailable` discriminated union)

**`extensions/pi-claude-marketplace/transaction/`:**
- Purpose: generic transactional primitives shared by every mutating orchestrator
- Contains: `phase-ledger.ts` (`runPhases`, `Phase<C>`), `with-state-guard.ts` (`withLockedStateTransaction`), `rollback.ts`

**`extensions/pi-claude-marketplace/persistence/`:**
- Purpose: typed, atomic, scope-rooted disk I/O for every file the extension owns
- Contains: `locations.ts` (branded path bundle), `state-io.ts`, `config-io.ts`/`config-merge.ts`/`config-write-back.ts`, `agents-index-io.ts`/`agents-index-schema.ts`, `migrate.ts`/`migrate-config.ts`

**`extensions/pi-claude-marketplace/platform/`:**
- Purpose: isolates the Pi API and git-library specifics from the rest of the codebase
- Contains: `pi-api.ts`, `git.ts`, `git-credential.ts`

**`extensions/pi-claude-marketplace/shared/`:**
- Purpose: leaf-level utilities with no internal dependencies, imported everywhere
- Contains: `notify.ts`/`notify-context.ts`/`notify-reasons.ts`, `errors.ts`/`errors-bridges.ts`, `path-safety.ts`, `atomic-json.ts`, `fs-utils.ts`, `concerns/soft-dep.ts`, `concerns/hooks.ts`, `debug-log.ts`, `types.ts`, `vars.ts`, `git-failure-classifiers.ts`, `probe-classifiers.ts`, `session-env.ts`, `markers.ts`, `extension-version.ts`, `completion-cache.ts`

**`tests/`:**
- Purpose: node:test suite mirroring `extensions/pi-claude-marketplace/` layer-by-layer, plus dedicated tiers for architectural constraints, integration, e2e, and live UAT
- Contains: `tests/architecture/` (source-grep constraint tests like `no-orchestrator-network.test.ts`), `tests/{domain,persistence,bridges,orchestrators,edge,platform,shared,transaction}/` (unit tests mirroring source dirs), `tests/integration/`, `tests/e2e/`, `tests/live-uat/`, `tests/fixtures/`, `tests/helpers/`

**`docs/`:**
- Purpose: authoritative specification and design documentation
- Contains: `docs/prd/pi-claude-marketplace-prd.md` — the 1068-line PRD that the successor architecture must satisfy; requirement IDs (PI-N, NFR-N, D-NN, etc.) from this document are cited throughout the source as comments

## Key File Locations

**Entry Points:**
- `extensions/pi-claude-marketplace/index.ts`: Pi extension factory — registers all top-level event/command handlers

**Configuration:**
- `package.json`: npm package manifest, peer deps (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `pi-subagents`, `typebox`)
- `tsconfig.json`: TypeScript strict-mode configuration
- `eslint.config.js`: flat ESLint config, including the notify-discipline BLOCK A custom rule
- `.prettierrc`: formatting rules

**Core Logic:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`: canonical 5-phase transactional ledger
- `extensions/pi-claude-marketplace/domain/resolver.ts`: discriminated-union plugin resolution (NFR-7)
- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`: generic ledger primitive

**Testing:**
- `tests/architecture/no-orchestrator-network.test.ts`: enforces NFR-5 network boundary via source grep
- `tests/helpers/`: shared test drivers/fixtures builders

## Naming Conventions

**Files:**
- Kebab-case `.ts` files throughout: `with-state-guard.ts`, `plugin-state-classifier.ts`, `git-failure-classifiers.ts`
- Orchestrator verb files paired with a `.messaging.ts` sibling of the same base name: `install.ts` + `install.messaging.ts`
- Bridge files use a fixed vocabulary per kind: `discover.ts`, `stage.ts`, `unstage.ts`, `types.ts`, `index.ts` (barrel)
- Test files mirror source paths one-to-one under `tests/`, suffixed `.test.ts`

**Directories:**
- One directory per architectural layer at the top of `extensions/pi-claude-marketplace/` (`edge`, `orchestrators`, `bridges`, `domain`, `transaction`, `persistence`, `platform`, `shared`)
- `orchestrators/` and `bridges/` further subdivide by domain concept (`plugin/`, `marketplace/`, `import/`, `reconcile/`; `skills/`, `commands/`, `agents/`, `mcp/`, `hooks/`)

## Where to Add New Code

**New plugin-lifecycle verb (e.g. a new `/claude:plugin <verb>`):**
- Edge handler: `extensions/pi-claude-marketplace/edge/handlers/plugin/<verb>.ts`, wire into `edge/router.ts` and `SubcommandHandlers`
- Orchestrator: `extensions/pi-claude-marketplace/orchestrators/plugin/<verb>.ts` + `<verb>.messaging.ts`, following the `runInstallLedger`/`withLockedStateTransaction` pattern if it mutates state
- Tests: `tests/edge/handlers/plugin/<verb>.test.ts`, `tests/orchestrators/plugin/<verb>.test.ts`

**New Claude-artifact component kind (new bridge):**
- Implementation: `extensions/pi-claude-marketplace/bridges/<kind>/` with `discover.ts`, `stage.ts`, `unstage.ts`, `types.ts`, `index.ts` matching the existing 5-bridge triplet convention
- Wire a new `Phase<InstallCtx>` into `orchestrators/plugin/install.ts` (and the symmetric uninstall/update/reinstall ledgers)
- Tests: `tests/bridges/<kind>/`

**Domain-level validation/resolution logic:**
- `extensions/pi-claude-marketplace/domain/` — keep pure (no fs writes); add typebox schemas under `domain/components/`

**Shared cross-cutting utility:**
- `extensions/pi-claude-marketplace/shared/` — only if genuinely leaf-level (no internal deps); if it needs `persistence/` or `domain/`, it belongs in a higher layer instead

## Special Directories

**`tests/fixtures/`:**
- Purpose: static fixture trees (sample plugin manifests, malformed imports, import-command configs) consumed by tests
- Generated: No
- Committed: Yes

**`.claude/gsd-migration-journal/`:**
- Purpose: GSD tooling's own migration rollback snapshots (unrelated to the extension's runtime code)
- Generated: Yes (by GSD tooling)
- Committed: Yes (historical journal)

**`coverage/`, `.pi-lens/cache/`, `.playwright-mcp/`, `tmp/`:**
- Purpose: build/test tool output (coverage reports, lens cache, playwright artifacts, scratch)
- Generated: Yes
- Committed: No (tool-generated, not source)

**`.worktrees/`:**
- Purpose: git worktrees for parallel feature branches, per project convention (`CLAUDE.md`: "Worktrees are preferred for new feature work")
- Generated: No (created per-branch by contributors)
- Committed: No (worktree contents are separate checkouts, not part of this tree's history)

---

*Structure analysis: 2026-08-07*
