# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Git hosting / source control:**
- GitHub (github.com) and GitLab (gitlab.com) - marketplace and plugin source repositories cloned/fetched over HTTPS
  - SDK/Client: `isomorphic-git` + `isomorphic-git/http/node` (`extensions/pi-claude-marketplace/platform/git.ts`)
  - Auth: OAuth Device Flow (RFC 8628), implemented once in `extensions/pi-claude-marketplace/domain/github-auth.ts` and shared by both hosts; host-keyed auth bundles built by `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`
  - Extensible to other git hosts: `extensions/pi-claude-marketplace/domain/auth-registry.ts` maps hosts to `GitAuthProvider` descriptors (two are registered, `GITHUB_PROVIDER` and `GITLAB_PROVIDER`; each `hostMatch` claims its SaaS host by exact equality only, so a self-managed or enterprise instance would add another descriptor)
  - Requested OAuth scope: `repo` on GitHub (full control of private repositories, needed for private marketplace/plugin sources), `read_repository` on GitLab

**OAuth Device Flow endpoints (called directly via `fetch`, no SDK):**
- `POST https://github.com/login/device/code` - request device code (GitHub)
- `POST https://github.com/login/oauth/access_token` - poll for access token (GitHub)
- `POST https://gitlab.com/oauth/authorize_device` - request device code (GitLab)
- `POST https://gitlab.com/oauth/token` - poll for access token (GitLab)
- Injectable `DeviceFlowHttp` seam (`DEFAULT_DEVICE_FLOW_HTTP` uses `globalThis.fetch`) so tests can mock without real network calls

## Data Storage

**Databases:**
- None. No SQL/NoSQL database is used.

**File Storage:**
- Local filesystem only. All state is persisted as JSON/YAML/Markdown files under:
  - `<scopeRoot>/pi-claude-marketplace/` (marketplace/plugin state, staging directories for atomic commits)
  - `<scopeRoot>/agents/` (rendered agent artifacts)
  - `<scopeRoot>/mcp.json` (MCP server registrations, written via the four-slot pi-mcp-adapter contract in `extensions/pi-claude-marketplace/bridges/mcp/`)
  - `<scopeRoot>/claude-plugins.json` / `<scopeRoot>/claude-plugins.local.json` (plugin/marketplace registry)
  - Two scopes only: `user` (defaults to `~/.pi/agent/`, overridable via `PI_CODING_AGENT_DIR`) and `project` (`<cwd>/.pi/`)

**Caching:**
- Local clone cache for plugin/marketplace git repositories under the scope root's `pi-claude-marketplace/` staging area (no external cache service)

## Authentication & Identity

**Auth Provider:**
- OAuth Device Flow against GitHub and GitLab (custom implementation, not a third-party auth SDK)
  - Engine: `extensions/pi-claude-marketplace/domain/github-auth.ts` (`initiateDeviceFlow`)
  - Provider registry: `extensions/pi-claude-marketplace/domain/auth-registry.ts` (`GITHUB_PROVIDER`, `GITLAB_PROVIDER`, `findProviderForHost`)
  - Bundle factory: `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` (`buildAuthForHost`, `hostFromCloneUrl`)
  - Credential persistence: delegated to the OS keychain via `git credential fill/approve/reject`, spawned as a subprocess by `extensions/pi-claude-marketplace/platform/git-credential.ts` (the only file permitted to spawn a `git` subprocess; `tests/architecture/no-shell-out.test.ts` whitelists exactly three `node:child_process` importers -- this one plus the two hook-exec lanes, `bridges/hooks/dispatch-exec.ts` and `bridges/hooks/async-rewake/registry.ts`)
  - Non-interactive guarantees: `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` set on the credential-helper subprocess so a cache miss never opens a browser/TTY prompt outside Pi's own Device Flow UI
  - Each provider's OAuth `client_id` is a public compile-time constant on its descriptor (safe to commit per RFC 8628 §3.1 -- Device Flow has no client_secret)
  - Credential-leak discipline: `tests/architecture/no-credential-leak.test.ts` statically greps every auth and credential surface -- `domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `platform/git-credential.ts`, `platform/git.ts`, `orchestrators/marketplace/{add,update}.ts` and the three state-write files -- to guarantee no access token or credential field is ever interpolated into a `notifyFn`/`ctx.ui.notify` call, an `Error` message, or a persisted state file

## Monitoring & Observability

**Error Tracking:**
- None. No telemetry, analytics, or error-tracking service is integrated (explicitly forbidden per project constraint IL-4: "No telemetry V1").

**Logs:**
- All user-visible output goes through `ctx.ui.notify(message, severity)` (the Pi host's notification channel); direct `process.stdout`/`process.stderr` writes are forbidden in command/bridge code (project constraint IL-2)
- One sanctioned `console.warn` exists for the load-time legacy-migration save-failure path (project constraint IL-3)

## CI/CD & Deployment

**Hosting:**
- No hosted runtime -- distributed purely as an npm package consumed by Pi hosts

**CI Pipeline:**
- GitHub Actions, defined in `.github/workflows/`:
  - `ci.yml` - four Node 24 jobs: `check` (`npm run check` = typecheck + ESLint + `fallow` + format check + unit tests + integration tests), `integration-tests`, `e2e-tests` (pinned-ref e2e), and `package` (`npm pack --dry-run`, gated on the other three). Triggers: push to `main`, PRs to `main` (both path-filtered, docs-only changes skipped), `workflow_dispatch`, and unfiltered `workflow_call` from `publish.yml`. There is no `features/**` push trigger -- a feature branch is covered through its PR
  - `lint.yml` - on PRs to `main` and `workflow_dispatch`; two jobs. `pre-commit` runs the whole `.pre-commit-config.yaml` pipeline (trufflehog, mdformat, markdownlint, yamlfmt/yamllint, gitlint, prettier, plus the local `npm lint`/`format:check`/`typecheck`/`fallow` hooks) via `pre-commit/action@v3.0.1`. `fallow-audit` runs the vendor action `fallow-rs/fallow@v3` with `command: audit` and `format: github-annotations` on a `fetch-depth: 0` checkout, gating only findings the PR newly introduced rather than inherited
  - `sonarcloud.yml` - `npm run test:coverage` then `SonarSource/sonarqube-scan-action@v8`, on push/PR to `main` (path-filtered); skipped for Dependabot and fork PRs, which cannot read `SONAR_TOKEN`
  - `e2e-nightly.yml` - nightly (cron `17 6 * * *`) end-to-end suite against `PI_CM_E2E_REF=main`
  - `publish.yml` - triggered on `v*` tags; runs the full `ci.yml` gate then publishes to npm with OIDC provenance (`id-token: write`, `npm publish --access public --provenance`)

**Static Analysis / Quality Gate:**
- SonarCloud (`sonar-project.properties`): project key `acolomba_pi-claude-marketplace`, org `acolomba`
  - Coverage ingested from `coverage/unit.lcov`, `coverage/integration.lcov`, `coverage/e2e.lcov`
  - Sources: `extensions/pi-claude-marketplace`; tests: `tests`
  - Copy-paste-detection exclusions documented inline for deliberately parallel rollback/resolution helpers and for the per-verb `*.messaging.ts` builders

## Environment Configuration

**Required env vars:**
- None required for normal operation (no `.env` file, no runtime secrets baked into config)
- Optional: `PI_CODING_AGENT_DIR` (relocate user scope), `TEST_CONCURRENCY` (test parallelism), `PI_CM_E2E_REF` (e2e suite target ref)

**Secrets location:**
- No secrets are stored in the repository. Host credentials obtained via OAuth Device Flow are persisted to the OS keychain (via `git credential approve`), never to a repo file or `.env`
- npm publish uses OIDC trusted publishing (`id-token: write` in `publish.yml`), not a static npm token secret

## Webhooks & Callbacks

**Incoming:**
- None. The extension runs inside the Pi host process; it does not expose any HTTP server or webhook endpoint.

**Outgoing:**
- None beyond the Device Flow polling calls described above (not webhooks, but polling HTTP requests to the GitHub and GitLab OAuth endpoints)

---

*Integration audit: 2026-08-07*
