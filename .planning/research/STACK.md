# Stack Research

**Domain:** Cucumber behavioral suite for `/claude:plugin marketplace`, with a loopback HTTPS git stand-in and a `GITHUB_BASE_URL` clone-base override (milestone `marketplace-features`)
**Researched:** 2026-10-15
**Confidence:** HIGH for the codebase facts, CI tool availability, and the cert-trust mechanics (all checked against code or run locally). MEDIUM for the `git http-backend` CGI details that its docs leave unstated.

## Bottom line

You do not need any new npm package. The milestone needs four things that already exist: the `git` CLI (it runs `git http-backend` and builds fixture repos), the `openssl` CLI (it makes a certificate at run time), `node:https`, and the `isomorphic-git` the extension already pins. All four are on `ubuntu-latest` and on dev machines.

The production change (D-MF-01) is one environment read, used in one function: `networkCloneUrl` in `domain/clone-key.ts`. The work is mostly about where **not** to apply it: the clone-key identity, the auth host, and the displayed source.

One finding goes back to the user as a question, because it was not known when D-MF-01 was decided. The name `GITHUB_BASE_URL` is already used by the Terraform GitHub provider, where it holds the **API** URL (`https://api.github.com/`). See "Open question" below.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `git` CLI (`git http-backend`) | system; 2.55.0 on `ubuntu-latest` (runner image 20261004) and on the Fedora dev box | Smart-HTTP server behind the `node:https` CGI wrapper; also builds the fixture repos | Upstream's own server, so the wire protocol is the real one. It is already on every runner and dev machine. Ubuntu/Debian ship it in the `git` package at `/usr/lib/git-core/git-http-backend`, Fedora in `git-core` at `/usr/libexec/git-core/` (checked). Spawn it as `git http-backend` so you never look up `--exec-path`. Spike of 2026-10-15 and the any-git-host UATs of 2026-09-28 proved isomorphic-git clone and fetch through it. |
| `openssl` CLI | system; 3.0.13 on `ubuntu-latest`; OpenSSL 4.0.3 on the dev box | Makes a self-signed certificate per worker at run time | Preinstalled everywhere the suite runs, no dependency, about 20 ms per cert (measured). Node's `crypto` can parse X.509 but cannot create it, so a pure-Node option needs a library. |
| `node:https` + `node:child_process` | Node 24 (CI) / `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | The roughly 25-line CGI wrapper; it records requests and can be armed to answer 401/404/5xx or to drop the connection | It is in the stdlib. The rule-pack bans on `node:https` (`no-network-modules`) cover `extensions/pi-claude-marketplace/**` only. `features/` is outside that scope. |
| `NODE_EXTRA_CA_CERTS` | Node built-in | Makes the Pi child trust the stand-in's certificate | Checked locally on Node 26.11.1. A Node child with no variable fails with `DEPTH_ZERO_SELF_SIGNED_CERT`. The same child with `NODE_EXTRA_CA_CERTS=<cert.pem>` connects. The `openssl req -x509` default adds `basicConstraints=critical,CA:TRUE`, so the leaf also works as its own trust anchor. Node reads the variable **once at process start**. |
| `@cucumber/cucumber` | 13.3.0 (already installed; latest on npm) | Runner | No change. |
| `isomorphic-git` | 1.42.3 installed (`^1.42.3`); 1.44.2 is latest | Client under test | Do **not** bump it in this milestone. A bump would change the code under test while the suite that should catch the change is still being built. |

### The certificate command (verified on OpenSSL 4.0.3; every flag also exists in 3.0.x)

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -keyout key.pem -out cert.pem -days 1 \
  -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1
```

- `-nodes`, not `-noenc`. `-noenc` is missing from OpenSSL 1.1 and LibreSSL (macOS). `-nodes` still works on 4.0 (checked).
- Use an **IP SAN for `127.0.0.1`**, and put `127.0.0.1` in every URL. Do not use `localhost`. Node resolves `localhost` in OS order and can try `::1` first, while the server listens on `127.0.0.1`.
- EC P-256 is faster than RSA, and every client here accepts it.
- `-days 1` is enough, because each run makes a new cert.

### Supporting Libraries

None. Each candidate below fails the dependency policy, or makes CI less likely to work:

| Considered | Version | Verdict |
|------------|---------|---------|
| `selfsigned` | 5.5.0 | **Do not add.** It now depends on `@peculiar/x509` plus `pkijs`, which is about 20 transitive packages (`@peculiar/asn1-*` x8, `tsyringe`, `asn1js`, `pvtsutils`, `bytestreamjs`, `@noble/hashes`, ...). It only replaces one `openssl` call that every target machine can already run. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm run test:cucumber` | Runs the suite | Already in `npm run check` and in the CI `behavioral` job (`ubuntu-latest`, Node 24, 10-minute timeout, `npm ci --ignore-scripts`). That job needs no new setup step, because `git` and `openssl` are on the image. It is **not** in `check:commit`, so commits that touch `features/` rely on `npm run check` at the GSD gates and on the CI job. |
| `tsc` / ESLint / fallow | Gate `features/**` | `tsconfig.json` includes `features/**/*.ts`. `npm run lint` covers `features`. fallow's `allowUnmatched` lists `features/**`, and `fallow dupes` (threshold 3) still reads it. If the git wrapper's spawn-and-collect code looks like `tests/e2e/_rpc.ts`, fallow can flag it as a clone. |

## Integration Points

### 1. The Pi child environment (`tests/e2e/_rpc.ts:166-173`)

`childEnvironment()` builds an allowlist from scratch: `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH`. Widen it with an **explicit, typed extra-env option** on `startRpcPi`/`RpcSandbox`. Do not spread `process.env`. The cucumber run passes:

| Variable | Value | Why |
|----------|-------|-----|
| `NODE_EXTRA_CA_CERTS` | **absolute** path to the worker's `cert.pem` | A relative path resolves against the child's cwd. A missing file only prints a warning, and every later clone fails as `DEPTH_ZERO_SELF_SIGNED_CERT`. `shared/git-failure-classifiers.ts` does not map that error to a reason. |
| `GITHUB_BASE_URL` | `https://127.0.0.1:<port>[/<prefix>]` | D-MF-01. |
| `GIT_CONFIG_NOSYSTEM` | `1` | On a 401, the extension spawns `git credential fill` with the child env (`platform/git-credential.ts:152`). `HOME` already isolates the global config. `/etc/gitconfig` can still name a credential helper (libsecret, GCM) on a dev box, and the suite must not query the real keychain. |

`PI_OFFLINE`/`--offline` does not affect the extension's isomorphic-git traffic. Pi reads it in `model-runtime`, `package-manager`, `version-check`, and `tools-manager` only.

**Ordering constraint.** Pi reads both variables only when it starts. The worker's Pi is started once in `BeforeAll` (`features/support/pi-process.ts`), and `Before()` restarts it with the same sandbox when a scenario leaves it busy. So the git stand-in must already be listening, and its cert must exist, **before** `PiProcess.start`. It must also outlive every Pi restart. Do not rely on cucumber's `BeforeAll` order across two support files. Make the stand-in part of the run's one module-level state (a field of `PiRun`, started in the same `BeforeAll`, reset in `Before()`, stopped in `AfterAll` after Pi). This also keeps to the cucumber rule that the slow process is the run's **only** module-level state.

### 2. The `git http-backend` CGI environment (worker side)

Build the CGI child env as an allowlist as well. Never use `...process.env`:

| Variable | Source |
|----------|--------|
| `GIT_PROJECT_ROOT` | worker's repo root (emptied per scenario) |
| `GIT_HTTP_EXPORT_ALL` | `1` (no `git-daemon-export-ok` files) |
| `PATH_INFO`, `REQUEST_METHOD`, `QUERY_STRING`, `CONTENT_TYPE` | from the request |
| `CONTENT_LENGTH` | **always set it**: buffer the request body and set its byte length. isomorphic-git's node client usually sends a Buffer with `content-length` (via `simple-get`). Its fallback path streams chunked. The http-backend docs do not say how an unset `CONTENT_LENGTH` behaves, so do not depend on it (MEDIUM). |
| `HTTP_CONTENT_ENCODING` | pass it through if present. isomorphic-git does not gzip request bodies, but real `git` does. |
| `GIT_PROTOCOL` | copy the `Git-Protocol` request header. http-backend copies `HTTP_GIT_PROTOCOL` itself (git-scm docs), and an explicit `GIT_PROTOCOL` wins. Marketplace add/update use clone + fetch (protocol v1: `GET info/refs` + `POST git-upload-pack`, per the 02-UAT wire log). `resolveRemoteRef`/`listRemoteTags` send `Git-Protocol: version=2` (`platform/git.ts:459,541`) only on plugin paths, which this milestone excludes. Passing the header through costs one line and keeps v2 working if a scenario reaches it. |
| `HOME` (temp), `GIT_CONFIG_NOSYSTEM=1`, `PATH` | keeps the developer's `~/.gitconfig` (for example `commit.gpgsign`, hooks, `init.defaultBranch`) out of both the server and the fixture builds |

Parse the CGI response yourself: a header block, then `Status:` (default 200), then the body.

**Why an allowlist and not inherit-and-override:** a run started from inside a git hook inherits `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_WORK_TREE`. Then the fixture `git commit` calls would write to **this repository**.

### 3. Fixture repos (git CLI, same isolated env)

- Make each fixture with `git -c init.defaultBranch=main init`. Set author and committer through `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL` in the env, so the run never touches config.
- To "publish an update", commit into the working repo that http-backend serves. Two ways: give the working tree a `--separate-git-dir` under `GIT_PROJECT_ROOT`, or point `PATH_INFO` at `<repo>/.git`.
- Layout: serve GitHub-shaped repos under a prefix (`/github/<owner>/<repo>.git`) and plain https-URL repos at the path the user types (`/<name>` or `/<name>.git`). This lets one server and one port cover both source kinds. `networkCloneUrl` appends `.git` on the github arm only and keeps the user's `.git` choice on the url arm (D-2-01/D-2-03), so the server has to answer exactly the path each form produces.

### 4. `GITHUB_BASE_URL` in production (D-MF-01)

**Where it plugs in: one place.** In `domain/clone-key.ts::networkCloneUrl`, the `github` arm:

```ts
case "github":
  return ensureGitSuffix(`${githubCloneBase()}/${source.owner}/${source.repo}`);
```

`githubCloneBase()` returns the trimmed override, or `https://github.com` when the variable is unset or empty. Both wire consumers already go through `networkCloneUrl`: `orchestrators/marketplace/add.ts:866` (clone) and `orchestrators/plugin/dependency-tag-probe.ts:159` (tag listing). `marketplace update` fetches `origin` from the clone's own config (`refreshGitHubClone`, `orchestrators/marketplace/shared.ts:259`), so it reaches the stand-in without any further change.

**Where it must NOT plug in:**

| Site | Keep as is | Why |
|------|------------|-----|
| `canonicalCloneUrl` (`clone-key.ts:81-85`) | `https://github.com/<o>/<r>` | It is the cache-key and dedup identity that `pluginCloneKey`/`pluginMirrorKey` hash, and the identity recorded in state. If it read the environment, `plugin-clones/` keys and record identity would depend on an env var. Its own doc comment already keeps it separate from the wire form. |
| `formatSourceForDisplay` (`domain/source.ts:762`) | `https://github.com/...` | Output must stay the same whether the variable is set or not. So scenarios assert the github.com form the user sees, and the override stays invisible. |
| `GITHUB_HOST` / `hostFromCloneUrl` (`orchestrators/auth-host.ts:81-99`), `update.ts:397-400`, `add.ts:974` | `github.com` | See the auth consequence below. |
| `auth-registry.ts` Device Flow URLs | `https://github.com/login/...` | Device Flow is out of scope. Its endpoints must never be redirected by a clone-base variable. |

**Auth consequence (check it in the plan; it is intended):** with the override set, a github source's auth bundle stays bound to `github.com`, while the request goes to `127.0.0.1:<port>`. `buildAuthCallbacks.onAuth` (`platform/git-auth-callbacks.ts:178`) sees the host mismatch and returns `{ cancel: true }` **before** it consults the credential helper or Device Flow. So a 401 on a GitHub-shaped stand-in can never reach github.com, a keychain, or a Device Flow prompt. That is the safety property you want. The cost: such a scenario sees "authentication required" through the mismatch guard, not the production path (helper, then Device Flow). **Do not write auth scenarios for github sources.** Cover 401 on the https-URL source, whose host matches the bundle, so the real `git credential fill` path runs.

**Leftover-clone consequence:** `originMatchesSource` (`clone-key.ts:117-128`, called from `add.ts:807`) compares the clone's `origin` with `canonicalCloneUrl(source)`. With the override set, a GitHub clone's origin is `https://127.0.0.1:<port>/.../<r>.git`, which parses as `url` kind and never matches `https://github.com/<o>/<r>`. So a "leftover clone is reused" scenario on a github source would fail as `{stale clone}`. Write leftover-clone scenarios on the https-URL source, or make `originMatchesSource` aware of the override (a larger production change, not part of D-MF-01).

**Lint and gate constraints on reading the environment:**

- No ESLint rule and no rule-pack rule bans `process.env`. BLOCK F (`eslint.config.js:361-391`) bans `platform/git` imports and the `gitOps`/`DEFAULT_GIT_OPS`/`refreshGitHubClone` names in non-seam `orchestrators/` and `domain/` modules. The rule pack bans stdio, console, notify, Pi peer, isomorphic-git, proper-lockfile, write-file-atomic, network modules, and `fetch`. Precedents for reading the environment: `platform/workflow-home.ts:36`, `shared/debug-log.ts:23`.
- **Naming trap:** BLOCK F's `no-restricted-imports` pattern is the **unanchored regex `platform/git`**. A helper named `platform/github-*.ts` or `platform/git-*.ts`, imported from `domain/clone-key.ts` (not a `NETWORK_SEAM`), fails lint. Put the reader in `shared/` (domain may import `shared` and `platform` under fallow's zones), or give a `platform/` file a name that does not start with `git`.
- Read the variable **per call**, not at module load, as `workflow-home.ts` does. Then a unit test can set it and restore it with `t.after()`. Accept only an `https:` URL: `onAuth` rejects anything else anyway, and `http://` is a refused form. Strip trailing slashes, and allow a path prefix.
- A new source file needs a paired test with 100% direct coverage (`test:corresponding` and `test:coverage:direct:all`). If you put the reader in an existing paired module, there is no new pair to keep.

### 5. isomorphic-git behaviors the stand-in must accommodate

| Behavior | Where | What it means for the stand-in |
|----------|-------|--------------------------------|
| A custom redirect follower; credentials stay on the original origin | `platform/git.ts:201-360` (cap 10; POST 301/302 becomes GET; 303/307/308 keep the method; cross-origin hops drop auth headers) | Not in the listed arming modes. A redirect mode would be an easy add later; the any-git-host UAT already covered it by hand. |
| Clone and fetch use protocol v1 | isomorphic-git | http-backend's default; nothing to set. |
| `listServerRefs` uses protocol v2 | `platform/git.ts:459,541` | Plugin paths only; pass `Git-Protocol` through (see §2). |
| Status mapping | `shared/git-failure-classifiers.ts` | 404 maps to `{source missing}`; 5xx and `ECONNRESET`/`ECONNREFUSED` map to `{network unreachable}`; 401/403 and `UserCanceledError` map to auth required. "Drop the connection" = `socket.destroy()` gives `ECONNRESET`. A TLS trust failure maps to no reason, so it looks like a wiring bug. Assert that the run's first scenario reaches the stand-in. |
| Credential lookup on a 401 | `git credential fill` with `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, host-keyed with no `path=` line | With the sandbox HOME and `GIT_CONFIG_NOSYSTEM=1`, the lookup misses quickly and the clone cancels cleanly. A "private marketplace authenticates" scenario can write `credential.helper=store` and `~/.git-credentials` into the sandbox HOME (user-owned files). Then the stand-in checks Basic auth. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `openssl` CLI at run time | `selfsigned@5.5.0` | Only if a supported dev platform lacks `openssl`. Today none does (Linux runners, Fedora, macOS LibreSSL, where the command above works with `-nodes`). |
| `openssl` CLI at run time | A cert and key checked in as a fixture | Never. The key expires, so the suite breaks on a date. A committed private key also invites scanner noise. The TruffleHog hook runs `filesystem --results=verified`, so an unverifiable key would not fail it today, but GitHub secret scanning or a later hook change could flag it. Run-time generation costs about 20 ms. |
| Override in `networkCloneUrl` only | Override in `canonicalCloneUrl` | Never. It would make the cache keys and the recorded identity depend on the environment. |
| Auth host stays `github.com` | Derive the auth host from `GITHUB_BASE_URL` | Only if github-source auth scenarios become a requirement. The bundle would then bind to the stand-in host with no provider, which makes the github path behave like the url path and **still** never exercises Device Flow. More production surface for no extra coverage. |
| `git http-backend` behind our `node:https` CGI wrapper | git-http-mock-server / mockttp / node-git-server / msw / nock / dugite | Decided: not re-litigated. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `selfsigned`, `node-forge`, `@peculiar/x509` | About 20 transitive packages for one cert; a new supply-chain surface in a repo whose dependency list is deliberately short | `openssl req -x509 ...` via `execFile` |
| `localhost` in stand-in URLs or certs | IPv6-first resolution can give `ECONNREFUSED`, and the SAN must match | `127.0.0.1` everywhere, IP SAN |
| `-noenc` in the openssl command | Missing from LibreSSL and OpenSSL 1.1 | `-nodes` |
| `...process.env` in the http-backend or fixture-git child env | Leaks `GIT_DIR`/`GIT_INDEX_FILE` from hooks and the user's gitconfig (gpgsign, hooks) | An explicit allowlist with a temp `HOME` and `GIT_CONFIG_NOSYSTEM=1` |
| `...process.env` in the Pi child env | Leaks provider credentials (the reason `_rpc.ts` is an allowlist) | Add the three named variables only |
| An `isomorphic-git` upgrade in this milestone | Changes the code under test while the suite is still being built | Keep `^1.42.3`; bump later, under the new suite |
| A per-scenario stand-in server | Pi reads `GITHUB_BASE_URL`/`NODE_EXTRA_CA_CERTS` only at start, and the port would change under a running Pi | One server per worker run, emptied and disarmed in `Before()` |
| `http://` stand-in | `http://` is a refused source form, and `onAuth` requires `https:` | HTTPS only |

## Stack Patterns by Variant

**If the scenario uses an https git URL source:**
- Serve it at the exact path the user types (with or without `.git`).
- 401 scenarios go here, because the auth host matches the bundle host and the real helper path runs.

**If the scenario uses a GitHub source (`owner/repo` or `https://github.com/o/r`):**
- Serve it at `<GITHUB_BASE_URL path>/<owner>/<repo>.git`.
- Assert the github.com display form. No auth scenarios, and no leftover-clone scenarios (see §4).

**If the scenario uses a local directory or a direct `marketplace.json` path:**
- No stand-in. Reuse `features/lib/path-marketplace.ts`. These are path sources, which never touch the network (NFR-5).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `isomorphic-git@1.42.3` | `git http-backend` 2.55.0 | Spike of 2026-10-15 plus the 2026-09-28 UATs (clone, fetch, verbatim path, Basic auth, redirects). |
| OpenSSL 3.0.13 (runner) / 4.0.3 (dev) | Node 24 / 26 bundled OpenSSL | The cert command works on both; Node trusts it via `NODE_EXTRA_CA_CERTS` (checked on Node 26.11.1). |
| `ubuntu-latest` | Moves to Ubuntu 26.04 in November 2026 | Newer git/OpenSSL; the flags above are stable across 3.x and 4.x. Nothing pins Ubuntu 24.04 in particular. |

## Open question (for the user, not decided here)

**The name `GITHUB_BASE_URL` collides with an established meaning.** The Terraform GitHub provider (`integrations/terraform-provider-github`, `provider.go`: `EnvDefaultFunc("GITHUB_BASE_URL", DotComAPIURL)`) reads it as the **API** base URL, for example `https://api.github.com/` or a GHES `/api/v3/` URL. Other tools, such as Elixir `git_store`, do the same. A Pi user who exports it for Terraform would have every GitHub marketplace clone go to `https://api.github.com/<o>/<r>.git` and fail. Claude Code 2.1.296 hardcodes `https://github.com/<repo>.git` and reads no such variable (binary grep), so there is no upstream name to match. A namespaced name in the house style of `PI_CLAUDE_MARKETPLACE_DEBUG` (for example `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`) would avoid the collision. D-MF-01 records the name, so this goes to the user as a question. It does not change the decision here.

## Sources

- Codebase (HIGH): `domain/clone-key.ts:61-128`, `orchestrators/auth-host.ts:81-99`, `orchestrators/marketplace/{add.ts:807,866,974; update.ts:388-400; shared.ts:252-264}`, `platform/git.ts:201-360,459,541`, `platform/git-auth-callbacks.ts:170-250`, `platform/git-credential.ts:145-160`, `shared/git-failure-classifiers.ts`, `eslint.config.js:44-106,361-391`, `rule-packs/architecture.json`, `.fallowrc.json`, `tests/e2e/_rpc.ts:166-173`, `features/support/pi-process.ts`, `.github/workflows/ci.yml` (`behavioral` job), `.pre-commit-config.yaml` (TruffleHog `--results=verified`), `node_modules/isomorphic-git/http/node/index.js:187-203`, `node_modules/simple-get/index.js:39`
- Local experiments (HIGH): the openssl command on OpenSSL 4.0.3 (22 ms; SAN and basicConstraints checked); a Node 26.11.1 child fails without `NODE_EXTRA_CA_CERTS` (`DEPTH_ZERO_SELF_SIGNED_CERT`) and succeeds with it; `git-http-backend` present in Fedora `git-core-2.55.0`
- [git-http-backend docs](https://git-scm.com/docs/git-http-backend) (MEDIUM): `HTTP_GIT_PROTOCOL` is copied to `GIT_PROTOCOL`, an explicit `GIT_PROTOCOL` takes precedence, `GIT_HTTP_EXPORT_ALL`, `GIT_PROJECT_ROOT`; silent on `CONTENT_LENGTH` and gzip
- [actions/runner-images Ubuntu 24.04 readme](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) (MEDIUM): image 20261004, Git 2.55.0, OpenSSL 3.0.13, `ubuntu-latest` moves to 26.04 in November 2026
- `npm view` (HIGH): `selfsigned@5.5.0` deps `@peculiar/x509`, `pkijs` (and their trees); `isomorphic-git@1.44.2` latest; `@cucumber/cucumber@13.3.0` latest
- [Terraform GitHub provider](https://github.com/integrations/terraform-provider-github) via `gh search code` (HIGH): `GITHUB_BASE_URL` is the API base URL
- Claude Code 2.1.296 binary grep (HIGH): GitHub clone URL hardcoded as `https://github.com/${repo}.git`; no base-URL env read for clones
- `.planning/milestones/ws-git-hosts-2026-10-01/.../01-UAT.md`, `02-UAT.md` (HIGH): prior runs of isomorphic-git against `git http-backend` behind Node HTTPS with `NODE_EXTRA_CA_CERTS`; marketplace add/update wire = `GET info/refs` + `POST git-upload-pack`

---
*Stack research for: marketplace behavioral tests (cucumber + loopback HTTPS git stand-in)*
*Researched: 2026-10-15*
