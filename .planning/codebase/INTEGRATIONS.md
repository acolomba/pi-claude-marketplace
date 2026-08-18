# External Integrations

**Analysis Date:** 2026-08-18

## APIs & External Services

**Git hosting (marketplace/plugin sources):**
- GitHub (`github.com`) and GitLab SaaS (`gitlab.com`) are both supported as git-source hosts, via a two-entry provider registry in `extensions/pi-claude-marketplace/domain/auth-registry.ts`. `GITLAB_PROVIDER.hostMatch` claims `gitlab.com` exactly (no self-managed GitLab instances -- device-authorization-grant support there is unverifiable per host). Both descriptors share one RFC-8628 Device Flow engine because GitLab's Device Authorization Grant matches GitHub's on field names, error codes, and request bodies.
  - GitHub: `deviceCodeUrl: https://github.com/login/device/code`, `tokenUrl: https://github.com/login/oauth/access_token`, scope `repo`, credential mapping `{ username: "x-access-token", password: accessToken }`
  - GitLab: scope `read_repository` (deliberately narrower than GitHub's `repo` -- this project only ever clones read-only); access tokens expire in 7200s with no refresh_token issued, unlike GitHub's non-expiring classic OAuth App tokens
  - Both `clientId` values are public OAuth/Application client IDs (Device Flow has no client_secret, so committing them as literals is safe per RFC 8628 §3.1, documented as D-32-03)
- Client: `isomorphic-git` (`extensions/pi-claude-marketplace/platform/git.ts`) performs clone/fetch/checkout over `isomorphic-git/http/node` as the HTTP transport -- no shell-out to a `git` binary for these operations
- Auth: `extensions/pi-claude-marketplace/platform/git-credential.ts` additionally shells out to the OS `git credential` helper chain (osxkeychain, manager-core, libsecret) to reuse locally cached credentials; this is one of exactly three files in the extension tree permitted to import `node:child_process` (enforced by `tests/architecture/no-shell-out.test.ts`'s `ALLOWED_CHILD_PROCESS_FILES` whitelist and its "exactly three files" assertion). The other two are `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (sync hook-command execution, EXEC-01..04) and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` (fire-and-forget async hook spawns with PID-table persistence, EXEC-05/HOOK-06)
- Network policy: git-source `marketplace add`/`update` require network; `install`/`update`/`reinstall` of git-source plugins require network only on cache miss (warm sha-pinned cache stays offline). `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations never touch the network. An architectural test (`tests/architecture/no-orchestrator-network.test.ts`) greps `orchestrators/plugin/install.ts`, `list.ts`, and `uninstall.ts` for forbidden git-surface imports/fields to enforce this at the source level

## Data Storage

**Databases:**
- None -- no external database. State is plain JSON on the local filesystem

**File Storage:**
- Local filesystem only, scope-rooted under `~/.pi/agent/` (user scope) or `<cwd>/.pi/` (project scope), addressed exclusively through `extensions/pi-claude-marketplace/persistence/locations.ts`'s `ScopedLocations` bundle. Key files: `pi-claude-marketplace/state.json`, `agents/agents-index.json`, `mcp.json`, `claude-plugins.json`/`claude-plugins.local.json`
- Git clones of marketplaces/plugin sources are cached on disk under a scope's `plugin-clones/<key>/` directory

**Caching:**
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` -- short-lived, explicitly-invalidated (`dropMarketplaceCache`) in-process cache for tab-completion data only; not authoritative state
- Git-source plugin clones are sha-pinned and cached on disk (see Network policy above) so warm operations avoid network entirely

## Authentication & Identity

**Auth Provider:**
- No user-account auth for the extension itself. Git host authentication only, via RFC-8628 OAuth Device Flow against GitHub and GitLab (see APIs & External Services above)
- Implementation: `extensions/pi-claude-marketplace/domain/auth-registry.ts` (provider descriptors) + a device-flow polling engine consuming those descriptors; `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` builds a host-keyed credential bundle, memoized once-per-host per command invocation (`authMemo`) to avoid repeated device-flow prompts during a bulk import cascade
- Credential-leak discipline: no credential field (access token, etc.) is ever interpolated into an `Error` or `notify()` call; enforced by `tests/architecture/no-credential-leak.test.ts`

## Monitoring & Observability

**Error Tracking:**
- None -- no external error-tracking/APM service integrated

**Logs:**
- `extensions/pi-claude-marketplace/shared/debug-log.ts` (`hookDebugLog`) -- a local debug-only trace channel, distinct from user-facing output; no external log shipping
- SonarCloud (`sonarcloud.yml`) is the closest thing to an external quality-observability integration -- static analysis + coverage reporting, not runtime monitoring

## CI/CD & Deployment

**Hosting:**
- npm registry (`https://registry.npmjs.org`) -- package published as `pi-claude-marketplace`

**CI Pipeline:**
- GitHub Actions, four workflow files (`ci.yml`, `lint.yml`, `sonarcloud.yml`, `e2e-nightly.yml`) plus `publish.yml` -- see STACK.md "CI Workflows" for the full breakdown
- SonarCloud (`SonarSource/sonarqube-scan-action@v8`) -- static analysis + coverage gate, project key `acolomba_pi-claude-marketplace`, organization `acolomba`; secrets (`SONAR_TOKEN`, `GITHUB_TOKEN`) unavailable to Dependabot and fork-originated PRs, so `sonarcloud.yml` skips those
- `fallow-rs/fallow@v3` GitHub Action (`lint.yml`'s `fallow-audit` job) -- runs `command: audit`, `format: github-annotations`, gating PRs on newly-introduced fallow findings only (distinct from the full local `npm run fallow` gate)

## Environment Configuration

**Required env vars:**
- None required for normal operation; all are optional overrides (`PI_CODING_AGENT_DIR`, `TEST_CONCURRENCY`, `PI_CM_E2E_REF`) or set internally by the extension itself (`GIT_TERMINAL_PROMPT`, `GCM_INTERACTIVE`) when shelling out to `git credential`

**Secrets location:**
- CI secrets (`SONAR_TOKEN`, npm publish token via OIDC `id-token: write` + `--provenance`) live in GitHub Actions repository/environment configuration, not in the repo
- No `.env` file or committed secrets file found in this tree

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None -- the extension makes outbound HTTP calls only to the two git-hosting OAuth device-flow endpoints (GitHub, GitLab) and to git remotes themselves during clone/fetch/pull; there is no webhook/callback surface

---

*Integration audit: 2026-08-18*
