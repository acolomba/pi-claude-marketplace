---
last_mapped_commit: 5960d1c02ed242faa6accd4c1ff5da8c84f2accd
last_mapped_at: 2026-10-05
---
# Codebase Structure

**Analysis Date:** 2026-10-05

## Directory Layout

```
pi-claude-marketplace/
├── extensions/pi-claude-marketplace/   # the extension source (268 .ts files, ~85k lines)
│   ├── index.ts                        # extension factory entry point
│   ├── edge/                           # CLI arg parsing, command dispatch, MCP tools
│   ├── orchestrators/                  # install/uninstall/update/marketplace/import/reconcile logic
│   ├── bridges/                        # per-artifact-kind translation (skills/commands/agents/mcp/hooks/workflows)
│   ├── domain/                         # pure resolution/validation (no disk writes)
│   ├── transaction/                    # phase-ledger primitive + state-lock guard
│   ├── persistence/                    # atomic state.json / config.json / agents-index.json I/O
│   ├── platform/                       # Pi API + git wrappers
│   └── shared/                         # leaf utilities: notify, errors, path-safety, atomic-json
├── tests/                              # 343 *.test.ts files, mirrors extensions/ layout, plus pi-runtime.ts support and index.test.ts
│   ├── architecture/                   # 49 tests — source-scan gates, catalog-uat/
│   ├── bridges/                        # 69 tests + _fixtures/ (fixture plugin trees, no .test.ts inside)
│   ├── domain/                         # 35 tests
│   ├── e2e/                            # 6 tests — exercises upstream refs (PI_CM_E2E_REF)
│   ├── edge/                           # 35 tests
│   ├── fixtures/                       # shared fixture data, no .test.ts files
│   ├── integration/                    # 16 tests
│   ├── live-uat/                       # standalone .mjs UAT drivers, no .test.ts files
│   ├── orchestrators/                  # 84 tests across plugin/, marketplace/, import/, reconcile/
│   ├── persistence/                    # 9 tests
│   ├── platform/                       # 9 tests
│   ├── shared/                         # 27 tests
│   └── transaction/                    # 3 tests
├── docs/                               # ADRs, PRDs, research, plans, style guides
│   ├── adr/
│   ├── prd/
│   ├── research/
│   ├── plans/
│   └── competitive-analysis/
├── scripts/                            # pi.sh launcher, run-parallel.mjs, test-coverage-direct.mjs, check-corresponding-tests.mjs, check-workflow-install-scripts.mjs, init*.sh, codegraph hooks
├── .planning/                          # GSD planning artifacts (codebase docs, milestones, seeds)
├── .fallowrc.json                      # fallow zone/boundary/health config
├── rule-packs/architecture.json        # fallow rule pack: call and import bans for the extension
├── eslint.config.js                    # flat ESLint config incl. architecture-boundary rules
├── tsconfig.json                       # strict TypeScript compiler options
└── package.json                        # scripts, deps, engines
```

## Directory Purposes

**`extensions/pi-claude-marketplace/edge/`:**
- Purpose: parse `/claude:plugin` subcommand strings and CLI flags, dispatch to exactly one orchestrator
- Contains: `router.ts`, `register.ts`, `args.ts`/`args-schema.ts`, `flag-catalog.ts`, `skill-aliases.ts`, `types.ts`, `browser/plugin-browser.ts` (pure-UI SelectList browser), `handlers/plugin/*.ts` (bootstrap, browse, enable-disable, fetch, help, import, info, install, list, pending, prune, reinstall, shared, uninstall, update), `handlers/marketplace/*.ts` (add, autoupdate, info, list, remove, shared, update), `handlers/shared.ts`, `handlers/tools.ts`, `completions/*.ts` (data, normalize, provider)
- Key files: `edge/router.ts` (subcommand table), `edge/handlers/tools.ts` (MCP tool registration)

**`extensions/pi-claude-marketplace/orchestrators/`:**
- Purpose: business logic for every mutating and read-only command
- Contains: `plugin/*.ts` (49 files; split verbs pair a `<verb>-flow.ts` ledger entry point with leaf modules: `install-flow.ts` + `install-outcome`/`install-cascade`/`install-clone-probe`/`install-declared-enabled`/`install-disable-cascade`; `update-flow.ts` + `update-swap`/`update-preflight`/`update-cascade`/`update-row`/`update-constraint-gate`; `reinstall-flow.ts` + `reinstall-clone-probe`/`reinstall-record`/`reinstall-replace`/`reinstall-targets`; `list-flow.ts` + `list-candidate-row`/`list-installed-row`/`list-orphan-fold`; single-file owners `uninstall.ts`, `info.ts`, `fetch.ts`, `enable-disable.ts`, `prune.ts` + `prune-rollback.ts`, `bootstrap.ts`; git/tag seams `clone-cache`, `clone-gc`, `git-source-probe`, `marketplace-tag-probe`, `dependency-tag-probe`; dependency helpers `dependency-declaration-read`, `dependency-index`; `operations.ts` (binds the real `runPhases` transaction), `plugin-state-classifier`, `discover-names`, `workflows-staging-gc`, `shared.ts`, plus a `*.messaging.ts` sibling per verb), `marketplace/*.ts` (add, remove, update, autoupdate, info, list, shared, plus `*.messaging.ts` siblings), `import/*.ts` (execute, execute.messaging, marketplaces, refs, settings, types, `index.ts` barrel), `reconcile/*.ts` (apply, apply-outcomes, backfill, plan, pending, notify, dependency-verdict, reconcile.messaging, types), top-level `discover.ts`, `edge-deps.ts`, `plugin-path.ts`, `auth-host.ts`, `scope-fanout.ts`, `skill-alias-state.ts`, `types.ts`
- Key files: `orchestrators/plugin/install-outcome.ts` (inner 7-phase ledger), `install-cascade.ts` and `enable-disable.ts` (cascade ledgers), `orchestrators/reconcile/apply.ts` (drives `resources_discover` self-healing)

**`extensions/pi-claude-marketplace/bridges/`:**
- Purpose: translate one Claude-plugin component kind into its Pi-native artifact
- Contains: `agents/` (convert, discover, frontmatter, index-mutation, marker, stage, types, unstage, plus barrel `index.ts`), `commands/` (discover, stage, types, unstage, barrel `index.ts`), `mcp/` (collision-slots, marker, parse, safe-set, stage, substitute, types, unstage, barrel `index.ts`), `skills/` (discover, frontmatter-degrade, frontmatter-scan, rewrite-frontmatter, stage, types, unstage, barrel `index.ts`), `workflows/` (discover, stage, types, unstage, barrel `index.ts`), `hooks/` (dispatch, dispatch-exec, event-adapters, event-router, exec-result, exec-timer, hook-env, routing-state, runtime, settle, spawn-helpers, stage, timeout, translation-context, wire-protocol, barrel `index.ts`, plus `if-field/` subdir — bash, glob, barrel `index.ts` — and `async-rewake/` subdir — pid-table, registry, ring-buffer — and `payloads/` subdir with one file per Claude Code hook event)
- Key files: `bridges/hooks/routing-state.ts` (leaf module that broke the `event-router.ts` ↔ `dispatch.ts` ↔ `async-rewake/registry.ts` cycle)

**`extensions/pi-claude-marketplace/domain/`:**
- Purpose: pure, network-free resolution/validation — no disk writes
- Contains: `plugin-resolver.ts` (the discriminated `installable` resolver) with `resolver-types.ts`, `unsupported-components.ts`, `component-paths.ts`, `mcp-resolution.ts`, `hooks-resolution.ts`, `dependencies.ts`, `dependency-closure.ts`, `dependency-orphans.ts`, `dependency-range.ts`, `release-tag.ts`, `skill-tokens.ts`, `manifest-path.ts`, `workflow-project-key.ts`, `workflow-script.ts`, `manifest.ts`, `manifest-cache.ts`, `manifest-lookup.ts`, `source.ts`, `version.ts`, `name.ts`, `plugin-root.ts`, `clone-key.ts`, `auth-registry.ts`, `github-auth.ts`, `components/` (hook-events, hook-if-targets, hook-tool-names, hooks, mcp, plugin, plus a `hooks/` subdir — typebox schemas, no barrel)

**`extensions/pi-claude-marketplace/transaction/`:**
- Purpose: generic phase-ledger primitive + cross-process state-lock guard
- Contains: `phase-ledger.ts`, `with-state-guard.ts`, `rollback.ts`

**`extensions/pi-claude-marketplace/persistence/`:**
- Purpose: atomic reads/writes of every on-disk artifact the extension owns
- Contains: `locations.ts` (branded `ScopedLocations`), `state-io.ts`, `config-io.ts`, `config-merge.ts`, `config-write-back.ts`, `agents-index-io.ts`, `agents-index-schema.ts`, `migrate.ts`, `migrate-config.ts`

**`extensions/pi-claude-marketplace/platform/`:**
- Purpose: thin typed wrappers over the Pi extension API and git
- Contains: `pi-api.ts` (sole Pi-peer import site), `git.ts` (sole `isomorphic-git` import site), `git-credential.ts`, `git-auth-callbacks.ts`, `os.ts`, `workflow-home.ts`

**`extensions/pi-claude-marketplace/shared/`:**
- Purpose: cross-cutting leaf utilities, no upward dependencies
- Contains: `notification-types.ts`, `notification-grammar.ts` (largest module), `notification-summary.ts`, `notification-dispatch.ts` (sole `ctx.ui.notify` site), `notify-context.ts`, `notify-reasons.ts`, `compare-name-scope.ts`, `redact-absolute-paths.ts`, `path-containment.ts`, `bom.ts`, `regexp.ts`, `errors.ts`, `errors-bridges.ts`, `path-safety.ts`, `atomic-json.ts`, `fs-utils.ts`, `debug-log.ts`, `types.ts`, `vars.ts`, `git-failure-classifiers.ts`, `probe-classifiers.ts`, `extension-version.ts`, `markers.ts`, `session-env.ts`, `completion-cache.ts`, `concerns/` (soft-dep, hooks)

## Key File Locations

**Entry Points:**
- `extensions/pi-claude-marketplace/index.ts`: extension factory — registers `resources_discover`, `session_start`, `/claude:plugin` command, MCP tools

**Configuration:**
- `.fallowrc.json`: fallow entry point, health thresholds (`maxCyclomatic: 20`, `maxCognitive: 15`, and `maxCrap: 0`, which switches CRAP off), 14-zone boundary rules, and `rulePacks`, which loads `rule-packs/architecture.json`
- `rule-packs/architecture.json`: the fallow rule pack, the call and import bans (stdio, console, `ui.notify`, Pi peer, `isomorphic-git`, `proper-lockfile`, `write-file-atomic`, network modules, `fetch`) scoped to `extensions/pi-claude-marketplace/**` with per-file chokepoint exemptions (see ARCHITECTURE.md and CONVENTIONS.md)
- `eslint.config.js`: flat ESLint config, incl. `import-x/no-restricted-paths` (BLOCK C: the 8-folder boundary matrix plus the D-v1.0-01-11 ledger zones over `PLUGIN_LEDGERS`/`MARKETPLACE_LEDGERS`), and BLOCK F's default-deny NFR-5 network-free rules over every `orchestrators/` and `domain/` module outside `NETWORK_SEAMS`
- `tsconfig.json`: strict compiler options, includes `extensions/**/*.ts` and `tests/**/*.ts`

**Core Logic:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`: install composition root; `install-outcome.ts` holds the 7-phase ledger body
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`: update ledger (hand-rolled heterogeneous undo, no `runPhases`)
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts`: discriminated-union plugin resolver

**Testing:**
- `tests/architecture/source-scan.ts`: shared grep/comment-stripping helpers used by architecture tests

## Naming Conventions

**Files:**
- `kebab-case.ts` throughout the extension and tests
- `*.messaging.ts` sibling holds a verb's notification-message builder (e.g. `install-flow.ts` uses `install.messaging.ts`); `-flow.ts` marks a split verb's ledger entry point
- `*.test.ts` for every test file; test directories mirror `extensions/pi-claude-marketplace/` subdirectory names 1:1

**Directories:**
- Layer names are singular-plural mixed by convention, not a rule: `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/`, `shared/`, `edge/`
- `bridges/<kind>/` and `orchestrators/<verb-group>/` subdirectories are named after the Claude-plugin artifact kind or command family they own

## Where to Add New Code

**New module under `orchestrators/` or `domain/`:**
- Default-deny applies from the first commit: it may not import `platform/git` or name `gitOps`/`DEFAULT_GIT_OPS`/`refreshGitHubClone` (BLOCK F). Add it to `NETWORK_SEAMS` in `eslint.config.js`, with a one-line reason, only when it must name the git surface itself.

**New CLI subcommand:**
- Router entry: `extensions/pi-claude-marketplace/edge/router.ts`
- Handler: `extensions/pi-claude-marketplace/edge/handlers/plugin/<verb>.ts` or `handlers/marketplace/<verb>.ts`
- Business logic: `extensions/pi-claude-marketplace/orchestrators/plugin/<verb>.ts` or `<verb>-flow.ts` (+ `<verb>.messaging.ts`) or `orchestrators/marketplace/<verb>.ts`
- Tests: `tests/edge/handlers/...` and `tests/orchestrators/plugin/<verb>.test.ts` or `tests/orchestrators/marketplace/<verb>.test.ts`

**New artifact-kind bridge:**
- Implementation: `extensions/pi-claude-marketplace/bridges/<kind>/` following the `discover.ts`/`stage.ts`/`unstage.ts`/`types.ts` shape, plus a barrel `index.ts`
- Wire into the install ledger: `orchestrators/plugin/install-outcome.ts` (add a phase to the literal `Phase<C>[]` array passed to `transaction.runPhases`); mirror it in `install-cascade.ts` and `enable-disable.ts` as needed
- Add a `.fallowrc.json` zone entry (`bridges-<kind>`) and a `rule-packs/architecture.json` exemption if it must own a chokepoint dependency; BLOCK C in `eslint.config.js` treats `bridges/` as one zone

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
- Purpose: standalone `.mjs` UAT drivers, excluded from the typed TypeScript tree (see the `eslint.config.js` ignored paths) and containing no `.test.ts` suites
- Committed: Yes

**`docs/`:**
- Purpose: ADRs (`docs/adr/`), PRDs (`docs/prd/`), research notes (`docs/research/`), execution plans (`docs/plans/`), competitive analysis, plus root-level `env-vars.md`, `hooks-compatibility.md`, `messaging-style-guide.md`, `output-catalog.md`
- Generated: No
- Committed: Yes
- Note: there is no `tests/docs` directory in this tree

---

*Structure analysis: 2026-10-05*
