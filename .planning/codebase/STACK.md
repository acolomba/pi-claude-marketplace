# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript `^6.0.3` (strict mode) - all extension source (`extensions/pi-claude-marketplace/`) and tests (`tests/`)

**Secondary:**
- YAML - Claude plugin manifests and marketplace metadata parsed via the `yaml` package
- Markdown - documentation, agent/skill/command definitions consumed as plugin artifacts

## Runtime

**Environment:**
- Node.js `>=20.19.0` (declared in `package.json` `engines`)
- ESM-only (`"type": "module"` in `package.json`)
- `tsconfig.json` targets `ES2022`, `module`/`moduleResolution: NodeNext`, `noEmit: true` (type-checking only; no build/transpile step -- Node's native TS stripping runs `.ts` files directly)

**Package Manager:**
- npm (lockfile: `package-lock.json`, present and committed)

## Frameworks

**Core:**
- No web/app framework -- this is a Pi extension (library-style), not a server or SPA
- `@earendil-works/pi-coding-agent` (peer dep `>=0.80.5`, dev dep `^0.83.0`) - the Pi extension host API (`ctx.ui.notify`, `resources_discover`, `session_start`, tool registration)
- `@earendil-works/pi-tui` (peer dep `*`, dev dep `^0.82.1`) - Pi terminal UI primitives
- `pi-subagents` (optional peer dep `>=0.35.0`) - soft-dependency companion extension for agent artifact rendering; degrades gracefully when absent

**Testing:**
- `node:test` (Node's built-in test runner) - all suites under `tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction,integration,e2e}/**/*.test.ts`
- `memfs` `^4.57.2` - in-memory filesystem mocking for platform/persistence tests
- Coverage via `node --test --experimental-test-coverage` with `lcov` reporters, split into `unit`, `integration`, `e2e` reports feeding SonarCloud

**Build/Dev:**
- No bundler/build step -- TypeScript is type-checked only (`tsc --noEmit`); Node runs `.ts` sources natively
- `eslint` `^10.4.0` with flat config (`eslint.config.js`, ~400 lines, includes custom architecture-boundary gates)
- `prettier` `^3.8.3` for formatting
- `pre-commit` framework (`.pre-commit-config.yaml`) runs trufflehog, markdownlint, yamlfmt, gitlint, mdformat, prettier alongside the JS/TS checks

## Key Dependencies

**Critical:**
- `isomorphic-git` `^1.38.1` - pure-JS git implementation used for marketplace clone/fetch/pull (no dependency on a `git` binary on PATH); wrapped in `extensions/pi-claude-marketplace/platform/git.ts`
- `typebox` `^1.1.38` (also a peer dep `*`) - runtime schema validation and discriminated-union modeling (e.g. `installable: true | false`)
- `write-file-atomic` `^8.0.0` - atomic JSON writes for `state.json`, `mcp.json`, `agents-index.json`
- `proper-lockfile` `^4.1.2` - cross-process file locking for `withStateGuard` concurrent-write detection
- `yaml` `^2.9.0` - parsing Claude plugin/marketplace YAML manifests

**Infrastructure:**
- `isomorphic-git/http/node` - the Node HTTP transport paired with `isomorphic-git` for actual network clone/fetch
- `@types/proper-lockfile`, `@types/write-file-atomic` - type definitions (dev only)

## Configuration

**Environment:**
- No `.env` files present; no runtime environment-variable-based secrets detected in the extension itself
- `PI_CODING_AGENT_DIR` - honored to relocate the Pi user-scope agent directory (defaults to `~/.pi/agent/`)
- `TEST_CONCURRENCY` - optional env var controlling `node --test` concurrency in npm scripts
- `PI_CM_E2E_REF` - set to `pinned` or `main` in e2e test scripts to select which upstream ref the e2e suite exercises
- `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` - set by `platform/git-credential.ts` when spawning `git credential` subprocesses to force non-interactive behavior

**Build:**
- `tsconfig.json` - strict TypeScript compiler options (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.), includes `extensions/**/*.ts` and `tests/**/*.ts`
- `eslint.config.js` - flat ESLint config with `typescript-eslint`, `@stylistic/eslint-plugin`, `eslint-plugin-import-x`, `eslint-plugin-sonarjs`, plus project-specific architecture-boundary rules (e.g. no-shell-out, no-credential-leak, no-orchestrator-network gates enforced as tests, not lint rules)
- `.prettierrc.json` / `.prettierignore` - formatting config
- `sonar-project.properties` - SonarCloud project settings (`acolomba_pi-claude-marketplace`), coverage report paths, copy-paste-detection exclusions

## Platform Requirements

**Development:**
- Node `>=20.19.0`
- npm for dependency install
- `pre-commit` (Python-based framework) for the git hook pipeline

**Production:**
- Distributed as an npm package (`pi-claude-marketplace`) consumed as a Pi extension via `pi.extensions` in `package.json`, pointing at `./extensions/pi-claude-marketplace/index.ts`
- Runs inside a host Pi agent process (`@earendil-works/pi-coding-agent`) -- no standalone server or deployment target of its own
- Published to npm via GitHub Actions on `v*` tags (`.github/workflows/publish.yml`, `id-token: write` for npm provenance)

---

*Stack analysis: 2026-08-07*
