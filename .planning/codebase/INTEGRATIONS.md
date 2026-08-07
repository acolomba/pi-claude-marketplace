# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Git hosting / source control:**
- GitHub (github.com) - marketplace and plugin source repositories cloned/fetched over HTTPS
  - SDK/Client: `isomorphic-git` + `isomorphic-git/http/node` (`extensions/pi-claude-marketplace/platform/git.ts`)
  - Auth: GitHub OAuth Device Flow (RFC 8628), implemented in `extensions/pi-claude-marketplace/domain/github-auth.ts`; host-keyed auth bundles built by `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`
  - Extensible to other git hosts: `extensions/pi-claude-marketplace/domain/auth-registry.ts` maps hosts to `GitAuthProvider` descriptors (currently only `GITHUB_PROVIDER` is registered; a future enterprise host would add another descriptor)
  - Requested OAuth scope: `repo` (full control of private repositories, needed for private marketplace/plugin sources)

**GitHub OAuth Device Flow endpoints (called directly via `fetch`, no SDK):**
- `POST https://github.com/login/device/code` - request device code
- `POST https://github.com/login/oauth/access_token` - poll for access token
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
- GitHub OAuth Device Flow (custom implementation, not a third-party auth SDK)
  - Engine: `extensions/pi-claude-marketplace/domain/github-auth.ts` (`initiateDeviceFlow`)
  - Provider registry: `extensions/pi-claude-marketplace/domain/auth-registry.ts` (`GITHUB_PROVIDER`, `findProviderForHost`)
  - Bundle factory: `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` (`buildAuthForHost`, `hostFromCloneUrl`)
  - Credential persistence: delegated to the OS keychain via `git credential fill/approve/reject`, spawned as a subprocess by `extensions/pi-claude-marketplace/platform/git-credential.ts` (the only file in the codebase permitted to import `node:child_process`, enforced by `tests/architecture/no-shell-out.test.ts`)
  - Non-interactive guarantees: `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` set on the credential-helper subprocess so a cache miss never opens a browser/TTY prompt outside Pi's own Device Flow UI
  - OAuth App `client_id` is a public compile-time constant on `GITHUB_PROVIDER` (safe to commit per RFC 8628 §3.1 -- Device Flow has no client_secret)
  - Credential-leak discipline: `tests/architecture/no-credential-leak.test.ts` statically greps `domain/github-auth.ts` and `orchestrators/auth-host.ts` to guarantee no access token or credential field is ever interpolated into a `notifyFn` call or `Error` message

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
  - `ci.yml` - typecheck, lint, format check, unit + integration tests on push to `main`/`features/**` and on PRs to `main` (path-filtered, docs-only changes skipped); reusable via `workflow_call`
  - `lint.yml` - additional lint checks
  - `sonarcloud.yml` - SonarCloud static analysis on push/PR to `main`
  - `e2e-nightly.yml` - nightly end-to-end suite against `PI_CM_E2E_REF=main`
  - `publish.yml` - triggered on `v*` tags; runs the full `ci.yml` gate then publishes to npm with OIDC provenance (`id-token: write`)

**Static Analysis / Quality Gate:**
- SonarCloud (`sonar-project.properties`): project key `acolomba_pi-claude-marketplace`, org `acolomba`
  - Coverage ingested from `coverage/unit.lcov`, `coverage/integration.lcov`, `coverage/e2e.lcov`
  - Sources: `extensions/pi-claude-marketplace`; tests: `tests`
  - Copy-paste-detection exclusions documented inline for deliberately parallel rollback/resolution helpers

## Environment Configuration

**Required env vars:**
- None required for normal operation (no `.env` file, no runtime secrets baked into config)
- Optional: `PI_CODING_AGENT_DIR` (relocate user scope), `TEST_CONCURRENCY` (test parallelism), `PI_CM_E2E_REF` (e2e suite target ref)

**Secrets location:**
- No secrets are stored in the repository. GitHub credentials obtained via OAuth Device Flow are persisted to the OS keychain (via `git credential approve`), never to a repo file or `.env`
- npm publish uses OIDC trusted publishing (`id-token: write` in `publish.yml`), not a static npm token secret

## Webhooks & Callbacks

**Incoming:**
- None. The extension runs inside the Pi host process; it does not expose any HTTP server or webhook endpoint.

**Outgoing:**
- None beyond the GitHub Device Flow polling calls described above (not webhooks, but polling HTTP requests to GitHub's OAuth endpoints)

---

*Integration audit: 2026-08-07*
