# Technology Stack

**Analysis Date:** 2026-08-18

## Languages

**Primary:**
- TypeScript `^6.0.3` (strict mode) - all extension source (`extensions/pi-claude-marketplace/`) and tests (`tests/`)

**Secondary:**
- YAML - agent and skill frontmatter, read and emitted line-by-line by `bridges/agents/frontmatter.ts` and `bridges/skills/frontmatter-degrade.ts` (line-based, no nested mappings), not via a YAML library. Plugin and marketplace manifests are JSON and go through `JSON.parse`
- Markdown - documentation, agent/skill/command definitions consumed as plugin artifacts

## Runtime

**Environment:**
- Node.js `>=20.19.0` declared in `package.json` `engines`; CI pins and runs the pipeline on Node 24 only (`.github/workflows/ci.yml`, D-01: single-Node-version matrix, justified there by `write-file-atomic@^8`'s `^22.22.2 || ^24.15.0 || >=26.0.0` engine floor and native TS-strip support)
- ESM-only (`"type": "module"` in `package.json`)
- `tsconfig.json` targets `ES2022`, `module`/`moduleResolution: NodeNext`, `noEmit: true` (type-checking only; no build/transpile step -- Node's native TS stripping runs `.ts` files directly)

**Package Manager:**
- npm (lockfile: `package-lock.json`, present and committed; CI uses `npm ci`)

## Frameworks

**Core:**
- No web/app framework -- this is a Pi extension (library-style), not a server or SPA
- `@earendil-works/pi-coding-agent` (peer dep `>=0.80.5`, dev dep `^0.84.2`) - the Pi extension host API (`ctx.ui.notify`, `resources_discover`, `session_start`, tool registration)
- `@earendil-works/pi-tui` (peer dep `*`, dev dep `^0.84.1`) - Pi terminal UI primitives
- `pi-subagents` (optional peer dep `>=0.35.0`) - soft-dependency companion extension for agent artifact rendering; degrades gracefully when absent

**Testing:**
- `node:test` (Node's built-in test runner) - suites under `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` (`npm test`), plus a separate `tests/integration/**/*.test.ts` suite (`npm run test:integration`) and `tests/e2e/**/*.test.ts` (`npm run test:e2e`, pinned ref; `npm run test:e2e:nightly` runs against floating `main`)
- Real temporary directories (`mkdtemp`, plus a `withHermeticHome` helper) for filesystem isolation -- no in-memory filesystem layer is used
- Coverage via `node --test --experimental-test-coverage` with `lcov` reporters, split into `unit`/`integration`/`e2e` reports (`npm run test:coverage`) feeding SonarCloud (`sonar.javascript.lcov.reportPaths=coverage/unit.lcov,coverage/integration.lcov,coverage/e2e.lcov` in `sonar-project.properties`)

**Build/Dev:**
- No bundler/build step -- TypeScript is type-checked only (`tsc --noEmit`); Node runs `.ts` sources natively
- `eslint` `^10.4.0` with flat config (`eslint.config.js`, ~400 lines), including custom architecture-boundary and output-discipline rules (`no-restricted-syntax` forbids `process.stdout.write`/`process.stderr.write` in `extensions/pi-claude-marketplace/**`)
- `prettier` `^3.8.3` for formatting (`npm run format` / `format:check`)
- `fallow` `^3.16.0` - whole-graph static analysis (`.fallowrc.json`). `npm run fallow` chains three subcommands, each `--fail-on-issues --format human`, run whole-repo:
  - `fallow dead-code` (entry point `extensions/pi-claude-marketplace/index.ts`)
  - `fallow health` (`maxCyclomatic: 20`, `maxCognitive: 15`, `maxUnitSize: 60`, `maxCrap: 0`)
  - `fallow dupes` (`threshold: 3`, with two ignored-clone IDs pre-approved in `duplicates.ignoredClones`)
  - `.fallowrc.json`'s `boundaries` block defines 12 architecture zones (`entry`, `edge`, `orchestrators`, `bridges-agents`, `bridges-commands`, `bridges-mcp`, `bridges-skills`, `bridges-hooks`, `domain`, `transaction`, `persistence`, `platform`, `shared`) with an explicit allow-list of legal import edges between zones, plus a `calls.forbidden` block barring `process.stdout.*`/`process.stderr.*` from every zone -- finer-grained than the ESLint `no-restricted-paths` gate and the only mechanism enforcing that cross-bridge imports (e.g. `bridges-agents` -> `bridges-commands`) are forbidden
  - CI runs a separate `fallow-audit` job (`.github/workflows/lint.yml`) using the vendor action `fallow-rs/fallow@v3` with `command: audit`, `format: github-annotations` -- this gates PRs on newly-introduced findings only, distinct from the full `npm run fallow` gate that `npm run check` runs
- `pre-commit` framework (`.pre-commit-config.yaml`) runs trufflehog, gitlint, yamllint, yamlfmt, mdformat, markdownlint-cli2, texthooks (smartquotes/dashes/ligatures/bidi-control fixers), plus local hooks `npm-lint`, `npm-format-check`, `npm-typecheck`, and `npm-fallow` (this last one `always_run: true`, i.e. it runs on every commit regardless of which files changed)

## Key Dependencies

**Critical:**
- `isomorphic-git` `^1.38.1` - pure-JS git implementation used for marketplace clone/fetch/pull (no dependency on a `git` binary on PATH); wrapped in `extensions/pi-claude-marketplace/platform/git.ts`, paired with `isomorphic-git/http/node` as its HTTP transport (`platform/git.ts:4`)
- `typebox` `^1.1.38` (also a peer dep `*`) - runtime schema validation and discriminated-union modeling (e.g. `installable: true | false`)
- `write-file-atomic` `^8.0.0` - atomic JSON writes for `state.json`, `mcp.json`, `agents-index.json`
- `proper-lockfile` `^4.1.2` - cross-process file locking for `withStateGuard` concurrent-write detection

**Infrastructure:**
- `@types/proper-lockfile`, `@types/write-file-atomic` - type definitions (dev only)

## Configuration

**Environment:**
- No `.env` files present; no runtime environment-variable-based secrets detected in the extension itself
- `PI_CODING_AGENT_DIR` - honored to relocate the Pi user-scope agent directory (defaults to `~/.pi/agent/`)
- `TEST_CONCURRENCY` - optional env var controlling `node --test` concurrency in npm scripts
- `PI_CM_E2E_REF` - set to `pinned` (default `test:e2e`) or `main` (`test:e2e:nightly`) to select which upstream ref the e2e suite exercises
- `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` - set by `platform/git-credential.ts` when spawning `git credential` subprocesses to force non-interactive behavior

**Build:**
- `tsconfig.json` - strict TypeScript compiler options (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.), includes `extensions/**/*.ts` and `tests/**/*.ts`
- `eslint.config.js` - flat ESLint config with `typescript-eslint`, `@stylistic/eslint-plugin`, `eslint-plugin-import-x`, `eslint-plugin-sonarjs`, plus project-specific architecture-boundary rules
- `.fallowrc.json` - fallow zone/boundary/health/dupes configuration (see Build/Dev above)
- `.prettierrc.json` / `.prettierignore` - formatting config
- `sonar-project.properties` - SonarCloud project settings (`sonar.projectKey=acolomba_pi-claude-marketplace`, `sonar.organization=acolomba`), coverage report paths, and a documented `sonar.cpd.exclusions` list for deliberately-parallel-structure files (agents/commands bridge `stage.ts`, `orchestrators/plugin/shared.ts`, several `*.messaging.ts` files)

## Platform Requirements

**Development:**
- Node `>=20.19.0` (engines floor); CI and local `.pre-commit-config.yaml` Node setup both use Node 24
- npm for dependency install
- `pre-commit` (Python-based framework, Python 3.12 in CI) for the git hook pipeline

**Production:**
- Distributed as an npm package (`pi-claude-marketplace`, currently `0.16.0`) consumed as a Pi extension via `pi.extensions` in `package.json`, pointing at `./extensions/pi-claude-marketplace/index.ts`
- Runs inside a host Pi agent process (`@earendil-works/pi-coding-agent`) -- no standalone server or deployment target of its own
- Published to npm via GitHub Actions on `v*` tags (`.github/workflows/publish.yml`, which calls `ci.yml` as a reusable workflow via `workflow_call` before publishing, `id-token: write` for npm provenance)

## CI Workflows

Four workflow files in `.github/workflows/`:
- `ci.yml` - `workflow_call` (invoked by `publish.yml`), plus `push`/`pull_request` on `main` (paths-ignore for docs/planning), plus `workflow_dispatch`. Jobs: `check` (`npm run check`), `integration-tests`, `e2e-tests` (pinned ref), `package` (`npm pack --dry-run`, depends on the other three). All run on Node 24. There is deliberately no `push` trigger on `features/**` branches
- `lint.yml` - `pull_request` on `main` + `workflow_dispatch`. Two jobs: `pre-commit` (runs the full `.pre-commit-config.yaml` pipeline via `pre-commit/action@v3.0.1`) and `fallow-audit` (the vendor `fallow-rs/fallow@v3` action, `command: audit`, `format: github-annotations`, `fetch-depth: 0`) -- separate from and additional to the `npm run fallow` gate embedded in `npm run check`
- `sonarcloud.yml` - `push`/`pull_request` on `main`, skipped for Dependabot and fork PRs (no secrets access); runs `npm run test:coverage` then `SonarSource/sonarqube-scan-action@v8`
- `e2e-nightly.yml` - `schedule` (`17 6 * * *`) + `workflow_dispatch`; runs `npm run test:e2e:nightly` (`PI_CM_E2E_REF=main`) against floating upstream `main`
- `publish.yml` - `push` on `v*` tags only; calls `ci.yml` via `workflow_call`, then publishes to npm with `--provenance` on success

---

*Stack analysis: 2026-08-18*
