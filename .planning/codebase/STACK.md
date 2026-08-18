# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript `^6.0.3` (strict mode) - all extension source (`extensions/pi-claude-marketplace/`) and tests (`tests/`)

**Secondary:**
- YAML - agent and skill frontmatter, read and emitted line-by-line by `bridges/agents/frontmatter.ts` and `bridges/skills/frontmatter-degrade.ts` (D-82-02: line-based, no nested mappings), not via a YAML library. Plugin and marketplace manifests are JSON and go through `JSON.parse`
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
- `node:test` (Node's built-in test runner) - all suites under `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction,integration,e2e}/**/*.test.ts`. Two more directories under `tests/` hold no suites: `tests/fixtures/` (JSON and `.ts` inputs the boundary and import tests read) and `tests/live-uat/` (standalone operator-run `.mjs` drivers, excluded from the ESLint typed tree)
- Real temporary directories (`mkdtemp`, plus the `withHermeticHome` helper) for filesystem isolation - no in-memory filesystem layer is used
- Coverage via `node --test --experimental-test-coverage` with `lcov` reporters, split into `unit`, `integration`, `e2e` reports feeding SonarCloud

**Build/Dev:**
- No bundler/build step -- TypeScript is type-checked only (`tsc --noEmit`); Node runs `.ts` sources natively
- `eslint` `^10.4.0` with flat config (`eslint.config.js`, ~400 lines, includes custom architecture-boundary gates)
- `prettier` `^3.8.3` for formatting
- `fallow` `^3.16.0` - whole-graph static analysis (`.fallowrc.json`). `npm run fallow` is three explicit invocations chained with `&&` -- `fallow dead-code --fail-on-issues`, `fallow health --fail-on-issues`, `fallow dupes --fail-on-issues` -- run over the WHOLE repository with no delta scoping. That identical command runs in two places: the `.pre-commit-config.yaml` `npm-fallow` hook (`always_run: true`, since health and duplication cover `tests/` too), and `npm run check` -- which is both the local gate and the CI gate, since `.github/workflows/ci.yml` runs `npm run check` on pull requests targeting `main`, on `main` pushes, and on the `v*` release path via `workflow_call`. The `features/**` push trigger was removed: it fired alongside `pull_request` on every feature-branch push, and the concurrency key differs per event by construction, so neither run could cancel the other and the whole workflow ran twice. A feature branch keeps full coverage through its pull request. There is deliberately no separate `fallow` job in `.github/workflows/lint.yml`: it would re-run the same whole-repo analysis a second time on every code pull request, and its only exclusive coverage would be docs-only pull requests that `ci.yml` skips via `paths-ignore` -- where fallow, which reads `.ts`, cannot produce a different answer. The blocking gate is whole-repo everywhere, so a green local run and a green pull request mean the same thing
  - A SECOND, additional job (`fallow-audit`) runs `fallow audit` on pull requests only. This is not a return of the old asymmetry: audit was previously the ONLY CI gate and was delta-scoped, so a dirty repository passed CI while local disagreed. The whole-repo `npm run fallow` is now the authority in every surface and blocks; audit adds a different job on top -- new-vs-inherited attribution scoped to the diff, so a finding the pull request INTRODUCED is separated from one it inherited. It runs through the vendor's `fallow-rs/fallow@v3` action rather than a hand-rolled script, which is why the job is two steps: the action's `auto-changed-since` default resolves the base from the pull request itself, so there is no explicit `git fetch` of the base branch and no `--base` expression to keep in sync. `fetch-depth: 0` is still required for that resolution. The action needs neither `setup-node` nor `npm ci` -- it downloads its own signature-verified binary, and audit was measured returning byte-identical attribution against a checkout with no `node_modules` at all. Its `version` input defaults to the `fallow` spec in `package.json`, so the CLI version stays pinned by the devDependency and does not drift from the local and pre-commit runs. Reporting stays on `--format github-annotations`, which renders on fork pull requests without a write token
  - Audit's default `new-only` gate means introduced dead-code or complexity yields `fail` and exits 1, while introduced duplication yields `warn` and exits 0. Duplication therefore stays gated by the repo-wide `duplicates.threshold` in `npm run fallow`, not by audit
  - Audit's styling analysis contributes NOTHING here: the repository has no CSS, so `styling_introduced` / `styling_inherited` are structurally 0 and must not be read as coverage
  - The 13-zone `boundaries` block is finer-grained than the ESLint `no-restricted-paths` gate and is the only thing enforcing that cross-bridge imports are forbidden. `boundaries.coverage.requireAllFiles` makes zone coverage complete by construction: a file matching no zone fails the gate and names its path, with `tests/**` and `eslint.config.js` explicitly out of scope via `allowUnmatched`. `boundaries.calls.forbidden` encodes IL-2 as a per-zone ban on `process.stdout.*` / `process.stderr.*`
  - `health` uses fallow's own defaults (cyclomatic 20, cognitive 15) with `maxCrap: 0`, which disables CRAP entirely -- complexity is gated here directly and coverage is gated by SonarCloud, so CRAP would be a third opinion about facts two gates already own (BACKLOG FLOW-05). `duplicates.threshold` is a real non-zero percentage; `0` means NO LIMIT, which is why `fallow dupes` used to exit 0 with 66 clone groups present
  - `production: false` admits tests to the reachability graph, which is what makes the `_*ForTest` seam convention analyzable. On its own that makes fallow promote every tsconfig-included file to an entry point, which would leave `unused_files` / `unused_exports` vacuous, so `includeEntryExports: true` is set alongside it: entry-file exports are then subject to unused-export detection instead of being auto-credited as used. Verified by plant -- a fresh orphan file exporting one unused function fails the gate. All five classes the `dead-code` invocation computes are live
  - Complements rather than replaces the ESLint gate -- fallow's checks are reachability-scoped, ESLint's are glob-based and reachability-blind. Fallow does NOT replace the NFR-5 architecture test: a planted `platform/git.ts` import plus a `clone()` call in `install.ts` was measured leaving `npm run fallow` at exit 0
- `pre-commit` framework (`.pre-commit-config.yaml`) runs trufflehog, markdownlint, yamlfmt, gitlint, mdformat, prettier alongside the JS/TS checks

## Key Dependencies

**Critical:**
- `isomorphic-git` `^1.38.1` - pure-JS git implementation used for marketplace clone/fetch/pull (no dependency on a `git` binary on PATH); wrapped in `extensions/pi-claude-marketplace/platform/git.ts`
- `typebox` `^1.1.38` (also a peer dep `*`) - runtime schema validation and discriminated-union modeling (e.g. `installable: true | false`)
- `write-file-atomic` `^8.0.0` - atomic JSON writes for `state.json`, `mcp.json`, `agents-index.json`
- `proper-lockfile` `^4.1.2` - cross-process file locking for `withStateGuard` concurrent-write detection

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
