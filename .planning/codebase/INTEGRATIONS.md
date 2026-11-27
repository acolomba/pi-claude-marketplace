---
last_mapped_commit: 5960d1c02ed242faa6accd4c1ff5da8c84f2accd
last_mapped_at: 2026-10-05
---
# External Integrations

**Analysis Date:** 2026-10-25

## APIs & External Services

**Git hosting (marketplace/plugin sources):**
- Any git host serves marketplace and plugin sources: GitHub `owner/repo` sources, and `url` and `git-subdir` sources on any host (GitHub, GitLab, Gitea, Bitbucket, self-hosted). Authentication is the user's own: ssh keys and the ssh agent, and the git credential helpers the user configured (`gh auth setup-git`, Git Credential Manager, `glab auth setup-git`, `store`, and others). The extension has no OAuth client, no token of its own, and no host registry (D-SG-27). A token an earlier release stored through its own sign-in stays in the user's helper and keeps working; the extension never deletes one (D-SG-28)
- Client: the user's system git, run by `extensions/pi-claude-marketplace/platform/git.ts` through `platform/git-process.ts`, the one git transport (D-SG-01, SG-TRN-01). A missing git fails as `{git missing}`. Every remote command (`clone --depth 1`, the SHA fetch, `ls-remote`) goes through `runRemote` in `git.ts`: the network lane, the time limit from `platform/git-timeout.ts` (`CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, D-SG-13), the command's abort signal, and, for a `https://github.com/` URL while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set, the `url.<base>/.insteadOf=https://github.com/` pair (D-SG-16). git asks the user's credential helpers itself, with the non-interactive environment of D-SG-05, and each command runs once. A host that gets no credential fails as `authentication required`, and a stored credential that the host refuses fails as `StoredCredentialRejectedError` (GAUTH-04)
- Update model (D-SG-10): a marketplace update, a warm plugin mirror refresh, and `plugin update`'s marketplace sync (PUP-2) run `refreshCloneBySwap` (`orchestrators/marketplace/clone-swap.ts`). An `ls-remote` of the ref decides freshness. A current checkout stays as it is. A stale one is cloned again into `sources-staging/<uuid>/` and swapped in through `sources-backup/<marketplace>/` or `plugin-clones-backup/<key>/`, and an interrupted swap is recovered on the next run. Each installed plugin's `node_modules` is carried from the old checkout into the new one. `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` keeps an unreachable marketplace checkout (D-SG-15); a plugin mirror is never kept
- Auth: git reads the user's own credential helper chain (osxkeychain, manager-core, libsecret, `store`) itself; the extension starts no `git credential` command, and `extensions/pi-claude-marketplace/platform/git-process.ts` is the one git process module. The files that may import `node:child_process` are the five that the rule pack's `child-process-chokepoint` rule exempts: `platform/git-process.ts`, `bridges/hooks/dispatch-exec.ts` (sync hook-command execution, EXEC-01..04), `bridges/hooks/async-rewake/registry.ts` (fire-and-forget async hook spawns with PID-table persistence, EXEC-05/HOOK-06), `platform/package-manager.ts`, and `platform/prompt-shell.ts`. `test/architecture/no-shell-out.test.ts` checks that list against the tree
- Network policy: git-source `marketplace add`/`update` require network; `install`/`update`/`reinstall` of git-source plugins require network only on cache miss (warm sha-pinned cache stays offline). `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations never touch the network. A load is offline unless `autoapply` is on, in which case it runs `apply` and may use the network as `apply` does (AAP-D1). ESLint BLOCK F in `eslint.config.js` enforces this at the source level: no `orchestrators/` or `domain/` module outside `NETWORK_SEAMS` (a default-deny list of the 16 modules that must name the git surface) may import `platform/git` or name `gitOps`, `DEFAULT_GIT_OPS`, or `refreshCloneBySwap`, so the list, info, uninstall, and `marketplace remove` owners are all gated

## Data Storage

**Databases:**
- None -- no external database. State is plain JSON on the local filesystem

**File Storage:**
- Local filesystem only, scope-rooted under `~/.pi/agent/` (user scope) or `<cwd>/.pi/` (project scope), addressed exclusively through `extensions/pi-claude-marketplace/persistence/locations.ts`'s `ScopedLocations` bundle. Key files: `pi-claude-marketplace/state.json`, `agents/agents-index.json`, `mcp.json`, `claude-plugins.json`/`claude-plugins.local.json`
- Git clones are cached on disk under the scope's extension root: a marketplace checkout under `sources/<marketplace>/`, a git-source plugin mirror under `plugin-clones/<key>/`. A refresh stages its new clone in `sources-staging/` and keeps the old one in `sources-backup/` or `plugin-clones-backup/` until the swap ends (D-SG-10)

**Caching:**
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` -- short-lived, explicitly-invalidated (`dropMarketplaceCache`) in-process cache for tab-completion data only; not authoritative state
- Git-source plugin clones are sha-pinned and cached on disk (see Network policy above) so warm operations avoid network entirely

## Authentication & Identity

**Auth Provider:**
- No user-account auth for the extension itself, and no sign-in of its own: git authenticates with what the machine holds, ssh keys and the user's git credential helpers (see APIs & External Services above, D-SG-27)
- Implementation: `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` binds each git request to its host (`authBundleFor`) and holds the D-1-02 hint text (`NO_STORED_CREDENTIAL_CAUSE`); `platform/git.ts` maps a refused credential to `StoredCredentialRejectedError` only for a request to the bundle's host (GAUTH-04)
- Credential-leak discipline: no credential field (access token, etc.) is ever interpolated into an `Error` or `notify()` call; enforced by `test/architecture/no-credential-leak.test.ts`

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
- GitHub Actions, five workflow files (`ci.yml`, `lint.yml`, `sonarcloud.yml`, `e2e-nightly.yml`, `publish.yml`) -- see STACK.md "CI Workflows" for the full breakdown
- SonarCloud (`SonarSource/sonarqube-scan-action@v8`) -- static analysis + coverage gate, project key `acolomba_pi-claude-marketplace`, organization `acolomba`; secrets (`SONAR_TOKEN`, `GITHUB_TOKEN`) unavailable to Dependabot and fork-originated PRs, so `sonarcloud.yml` skips those
- `fallow-rs/fallow@v3` GitHub Action (`lint.yml`'s `fallow-audit` job) -- runs `command: audit`, `format: github-annotations`, gating PRs on newly-introduced fallow findings only and failing on a `warn` verdict or degraded analysis (distinct from the full local `npm run fallow` gate)

## Environment Configuration

**Required env vars:**
- None required for normal operation; all are optional overrides (`PI_CODING_AGENT_DIR`, `TEST_CONCURRENCY`, `PI_CM_E2E_REF`) or set internally by the extension itself (`GIT_TERMINAL_PROMPT`, `GCM_INTERACTIVE`) on every git command it starts

**Secrets location:**
- CI secrets (`SONAR_TOKEN`, npm publish token via OIDC `id-token: write` + `--provenance`) live in GitHub Actions repository/environment configuration, not in the repo
- No `.env` file or committed secrets file found in this tree

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None -- the extension's own outbound HTTP is the hosted catalog download (`platform/hosted-manifest-fetch.ts`, the one `fetch` caller), and system git reaches git remotes during clone, fetch, and `ls-remote`; there is no webhook/callback surface

---

*Integration audit: 2026-10-05*
