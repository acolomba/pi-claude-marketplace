# Codebase Structure

**Analysis Date:** 2026-08-18

## Directory Layout

```
pi-claude-marketplace/
├── extensions/pi-claude-marketplace/   # the extension source (198 .ts files, ~60k lines)
│   ├── index.ts                        # extension factory entry point
│   ├── edge/                           # CLI arg parsing, command dispatch, MCP tools
│   ├── orchestrators/                  # install/uninstall/update/marketplace/import/reconcile logic
│   ├── bridges/                        # per-artifact-kind translation (skills/commands/agents/mcp/hooks)
│   ├── domain/                         # pure resolution/validation (no disk writes)
│   ├── transaction/                    # phase-ledger primitive + state-lock guard
│   ├── persistence/                    # atomic state.json / config.json / agents-index.json I/O
│   ├── platform/                       # Pi API + git wrappers
│   └── shared/                         # leaf utilities: notify, errors, path-safety, atomic-json
├── tests/                              # 230 *.test.ts files, mirrors extensions/ layout
│   ├── architecture/                   # 39 tests — import boundaries, cycle gate, network gate, catalog UAT
│   ├── bridges/                        # 47 tests + _fixtures/ (fixture plugin trees, no .test.ts inside)
│   ├── domain/                         # 13 tests
│   ├── e2e/                            # 6 tests — exercises upstream refs (PI_CM_E2E_REF)
│   ├── edge/                           # 27 tests
│   ├── fixtures/                       # shared fixture data, no .test.ts files
│   ├── helpers/                        # 1 test + test-only helper modules (mocks, source-scan)
│   ├── integration/                    # 10 tests
│   ├── live-uat/                       # standalone .mjs UAT drivers, no .test.ts files
│   ├── orchestrators/                  # 49 tests across plugin/, marketplace/, import/, reconcile/
│   ├── persistence/                    # 9 tests
│   ├── platform/                       # 4 tests
│   ├── shared/                         # 20 tests
│   └── transaction/                    # 4 tests
├── docs/                               # ADRs, PRDs, research, plans, style guides
│   ├── adr/
│   ├── prd/
│   ├── research/
│   ├── plans/
│   └── competitive-analysis/
├── scripts/pi.sh                       # dev-loop launcher script
├── .planning/                          # GSD planning artifacts (codebase docs, milestones, seeds)
├── .fallowrc.json                      # fallow zone/boundary/health config
├── eslint.config.js                    # flat ESLint config incl. architecture-boundary rules
├── tsconfig.json                       # strict TypeScript compiler options
└── package.json                        # scripts, deps, engines
```

## Directory Purposes

**`extensions/pi-claude-marketplace/edge/`:**
- Purpose: parse `/claude:plugin` subcommand strings and CLI flags, dispatch to exactly one orchestrator
- Contains: `router.ts`, `register.ts`, `args.ts`/`args-schema.ts`, `flag-catalog.ts`, `types.ts`, `handlers/plugin/*.ts` (bootstrap, enable-disable, fetch, import, info, install, list, pending, reinstall, shared, uninstall, update), `handlers/marketplace/*.ts` (add, autoupdate, info, list, remove, shared, update), `handlers/shared.ts`, `handlers/tools.ts`, `completions/*.ts` (data, normalize, provider)
- Key files: `edge/router.ts` (subcommand table), `edge/handlers/tools.ts` (MCP tool registration)

**`extensions/pi-claude-marketplace/orchestrators/`:**
- Purpose: business logic for every mutating and read-only command
- Contains: `plugin/*.ts` (install — 2441 lines, update — 3163 lines, uninstall, reinstall — 2053 lines, enable-disable, list — 1414 lines, info — 2302 lines, fetch, bootstrap, clone-cache, clone-gc, git-source-probe, plugin-state-classifier, discover-names, update-row, shared, plus a `*.messaging.ts` sibling per verb), `marketplace/*.ts` (add, remove, update, autoupdate, info, list, shared, plus `*.messaging.ts` siblings), `import/*.ts` (execute, marketplaces, refs, settings, types, `index.ts` barrel), `reconcile/*.ts` (apply, apply-outcomes, plan, pending, notify, types), top-level `discover.ts`, `edge-deps.ts`, `plugin-path.ts`, `auth-host.ts`, `types.ts`
- Key files: `orchestrators/plugin/install.ts` (sole `runPhases` call site), `orchestrators/reconcile/apply.ts` (drives `resources_discover` self-healing)

**`extensions/pi-claude-marketplace/bridges/`:**
- Purpose: translate one Claude-plugin component kind into its Pi-native artifact
- Contains: `agents/` (convert, discover, frontmatter, index-mutation, marker, stage, types, unstage, plus barrel `index.ts`), `commands/` (discover, stage, types, unstage, barrel `index.ts`), `mcp/` (collision-slots, marker, parse, safe-set, stage, substitute, types, unstage, barrel `index.ts`), `skills/` (discover, frontmatter-degrade, frontmatter-scan, rewrite-frontmatter, stage, types, unstage, barrel `index.ts`), `hooks/` (dispatch, dispatch-exec, event-adapters, event-router, exec-result, exec-timer, hook-env, routing-state, settle, spawn-helpers, stage, translation-context, wire-protocol, barrel `index.ts`, plus `if-field/` subdir — bash, glob, barrel `index.ts` — and `async-rewake/` subdir — pid-table, registry, ring-buffer — and `payloads/` subdir with one file per Claude Code hook event)
- Key files: `bridges/hooks/routing-state.ts` (leaf module that broke the `event-router.ts` ↔ `dispatch.ts` ↔ `async-rewake/registry.ts` cycle)

**`extensions/pi-claude-marketplace/domain/`:**
- Purpose: pure, network-free resolution/validation — no disk writes
- Contains: `resolver.ts` (1545 lines, largest domain file — the discriminated `installable` resolver), `manifest.ts`, `manifest-cache.ts`, `manifest-lookup.ts`, `source.ts`, `version.ts`, `name.ts`, `plugin-root.ts`, `clone-key.ts`, `auth-registry.ts`, `github-auth.ts`, `components/` (hook-events, hook-if-targets, hook-tool-names, hooks, mcp, plugin — typebox schemas, no barrel)

**`extensions/pi-claude-marketplace/transaction/`:**
- Purpose: generic phase-ledger primitive + cross-process state-lock guard
- Contains: `phase-ledger.ts`, `with-state-guard.ts`, `rollback.ts`

**`extensions/pi-claude-marketplace/persistence/`:**
- Purpose: atomic reads/writes of every on-disk artifact the extension owns
- Contains: `locations.ts` (branded `ScopedLocations`), `state-io.ts`, `config-io.ts`, `config-merge.ts`, `config-write-back.ts`, `agents-index-io.ts`, `agents-index-schema.ts`, `migrate.ts`, `migrate-config.ts`

**`extensions/pi-claude-marketplace/platform/`:**
- Purpose: thin typed wrappers over the Pi extension API and git
- Contains: `pi-api.ts`, `git.ts` (sole `isomorphic-git` import site), `git-credential.ts`

**`extensions/pi-claude-marketplace/shared/`:**
- Purpose: cross-cutting leaf utilities, no upward dependencies
- Contains: `notify.ts` (4039 lines — largest file in the extension), `notify-context.ts`, `notify-reasons.ts`, `errors.ts`, `errors-bridges.ts`, `path-safety.ts`, `atomic-json.ts`, `fs-utils.ts`, `debug-log.ts`, `types.ts`, `vars.ts`, `git-failure-classifiers.ts`, `probe-classifiers.ts`, `extension-version.ts`, `markers.ts`, `session-env.ts`, `completion-cache.ts`, `concerns/` (soft-dep, hooks)

## Key File Locations

**Entry Points:**
- `extensions/pi-claude-marketplace/index.ts`: extension factory — registers `resources_discover`, `session_start`, `/claude:plugin` command, MCP tools

**Configuration:**
- `.fallowrc.json`: fallow entry point, health thresholds (`maxCyclomatic: 20`, `maxCognitive: 15`, `maxUnitSize: 60`, `maxCrap: 0`), 13-zone boundary rules
- `eslint.config.js`: flat ESLint config, incl. `import-x/no-restricted-paths` (8-folder boundary matrix) and extension-scoped `no-restricted-syntax` (forbids `process.stdout`/`stderr` writes)
- `tsconfig.json`: strict compiler options, includes `extensions/**/*.ts` and `tests/**/*.ts`

**Core Logic:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`: install ledger (largest orchestrator by responsibility, 2441 lines)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`: largest single source file besides `notify.ts` (3163 lines)
- `extensions/pi-claude-marketplace/domain/resolver.ts`: discriminated-union plugin resolver

**Testing:**
- `tests/architecture/import-boundaries.test.ts`: ESLint-zone assertion + directed-edge grep cycle gate
- `tests/architecture/no-orchestrator-network.test.ts`: NFR-5 network-boundary source-grep gate
- `tests/helpers/source-scan.ts`: shared grep/comment-stripping helpers used by architecture tests

## Naming Conventions

**Files:**
- `kebab-case.ts` throughout the extension and tests
- `*.messaging.ts` sibling holds a verb's notification-message builder (e.g. `install.ts` / `install.messaging.ts`)
- `*.test.ts` for every test file; test directories mirror `extensions/pi-claude-marketplace/` subdirectory names 1:1

**Directories:**
- Layer names are singular-plural mixed by convention, not a rule: `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/`, `shared/`, `edge/`
- `bridges/<kind>/` and `orchestrators/<verb-group>/` subdirectories are named after the Claude-plugin artifact kind or command family they own

## Where to Add New Code

**New CLI subcommand:**
- Router entry: `extensions/pi-claude-marketplace/edge/router.ts`
- Handler: `extensions/pi-claude-marketplace/edge/handlers/plugin/<verb>.ts` or `handlers/marketplace/<verb>.ts`
- Business logic: `extensions/pi-claude-marketplace/orchestrators/plugin/<verb>.ts` (+ `<verb>.messaging.ts`) or `orchestrators/marketplace/<verb>.ts`
- Tests: `tests/edge/handlers/...` and `tests/orchestrators/plugin/<verb>.test.ts` or `tests/orchestrators/marketplace/<verb>.test.ts`

**New artifact-kind bridge:**
- Implementation: `extensions/pi-claude-marketplace/bridges/<kind>/` following the `discover.ts`/`stage.ts`/`unstage.ts`/`types.ts` shape, plus a barrel `index.ts`
- Wire into the install ledger: `orchestrators/plugin/install.ts` (add a phase to the literal `Phase<C>[]` array passed to `runPhases`)
- Add a `.fallowrc.json` zone entry (`bridges-<kind>`) and an `import-x/no-restricted-paths` zone in `eslint.config.js` to keep the boundary gates covering the new kind

**Utilities:**
- Cross-cutting, no-dependency helpers: `extensions/pi-claude-marketplace/shared/`
- Pure validation/resolution logic: `extensions/pi-claude-marketplace/domain/`

## Special Directories

**`.fallow/cache`:**
- Purpose: fallow's incremental-analysis cache
- Generated: Yes
- Committed: No (not verified against `.gitignore` here, but cache directories are standard non-source)

**`tests/fixtures/` and `tests/bridges/_fixtures/`:**
- Purpose: static fixture plugin trees (manifests, skills, agents, commands) consumed by bridge/discover tests
- Generated: No — hand-authored fixture data
- Committed: Yes
- Contains no `.test.ts` files itself

**`tests/live-uat/`:**
- Purpose: standalone `.mjs` UAT drivers, excluded from the typed TypeScript tree (see `eslint.config.js` ignored paths) and containing no `.test.ts` suites
- Committed: Yes

**`docs/`:**
- Purpose: ADRs (`docs/adr/`), PRDs (`docs/prd/`), research notes (`docs/research/`), execution plans (`docs/plans/`), competitive analysis, plus root-level `env-vars.md`, `hooks-compatibility.md`, `messaging-style-guide.md`, `output-catalog.md`
- Generated: No
- Committed: Yes
- Note: there is no `tests/docs` directory in this tree

---

*Structure analysis: 2026-08-18*
