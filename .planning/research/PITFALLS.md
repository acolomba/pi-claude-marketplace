# Pitfalls Research

**Domain:** Brownfield Pi extension: a cucumber behavioral suite for every `/claude:plugin marketplace` command, driven through a real headless Pi in RPC mode against local stand-ins (path, direct `marketplace.json`, loopback HTTPS `git http-backend`, and GitHub sources redirected by a new `GITHUB_BASE_URL`). Milestone `marketplace-features`.
**Researched:** 2026-10-15
**Confidence:** HIGH for everything read in this tree's source (`tests/e2e/_rpc.ts`, `features/**`, `orchestrators/auth-host.ts`, `domain/auth-registry.ts`, `orchestrators/marketplace/{add,update}.ts`, `domain/clone-key.ts`, `platform/git.ts`, `shared/redact-absolute-paths.ts`, `shared/notification-wire.ts`, `node_modules/isomorphic-git`, `node_modules/simple-get`) and in the archived any-git-host UAT (`.planning/milestones/ws-git-hosts-2026-10-01/.../01-UAT.md`, `02-UAT.md`). HIGH for the upstream-parity fact (grep of the installed Claude Code 2.1.296 binary: GitHub clone URLs are the literal `https://github.com/${repo}.git`, and no `GITHUB_BASE_URL` string exists). MEDIUM for `git http-backend` CGI behavior (from the spike and the earlier canaries, not re-read in git's source). MEDIUM for the Terraform `GITHUB_BASE_URL` collision (web search; the research seam rates that tier LOW, but two independent sources agree). LOW for macOS/LibreSSL behavior (not checked).

## Phase vocabulary used below

The roadmap does not exist yet. This file names phases by concern, in the order the pitfalls suggest:

| Tag | Concern |
| --- | --- |
| **OVERRIDE** | `GITHUB_BASE_URL` in production code, with its unit tests (D-MF-01) |
| **STAND-IN** | `features/lib/` loopback HTTPS git server: openssl cert, `node:https` CGI wrapper around `git http-backend`, request log, arming (401/404/5xx/drop), fixture repos |
| **RUN** | Pi run plumbing: env for the child (`NODE_EXTRA_CA_CERTS`, `GITHUB_BASE_URL`, git isolation), per-worker lifetime, the `Before()` reset |
| **DRIVER** | `features/lib/pi-commands.ts`: non-cascade payload kinds, one payload per marketplace from bare `update`, normalizing run tokens (paths, ports, timestamps) |
| **SCENARIOS** | `features/marketplace/*.feature` and their step modules |
| **GATE** | `npm run check` duration, CI job, unused-step check, milestone close |

## Critical Pitfalls

### Pitfall 1: A 401 scenario consults the developer's real git credential helper

**What goes wrong:**
On a 401, `platform/git-auth-callbacks.ts::onAuth` runs `git credential fill` (5 s timeout, `orchestrators/auth-host.ts`). `platform/git-credential.ts` spawns it with `{ ...process.env, GIT_TERMINAL_PROMPT: "0" }`, so the subprocess inherits Pi's environment. `tests/e2e/_rpc.ts::childEnvironment` builds that environment from scratch, with `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, and `PATH`. A sandboxed `HOME` keeps `~/.gitconfig` and `$HOME/.config/git/config` out. Nothing keeps the **system** config out. On this machine `/etc/gitconfig` exists (it holds git-lfs filters only). Homebrew and Apple git on macOS put `credential.helper=osxkeychain` in their system config, and some Linux images put `libsecret` there. With such a helper, a 401 scenario reads the developer's keychain for `127.0.0.1:<port>`. If a scenario then reaches `onAuthFailure` on a Device Flow host, it runs `git credential reject` and **erases a real stored credential**. Pitfall 3 shows how a Device Flow host can be bound while the override is set.

**Why it happens:**
"HOME is sandboxed" feels like full isolation. Git has three config levels, and only `GIT_CONFIG_NOSYSTEM` turns off the system level. A credential helper also reaches state outside `HOME`: a keychain, a D-Bus secret service, or a cache socket.

**How to avoid:**
- Add `GIT_CONFIG_NOSYSTEM: "1"` to the Pi child environment. Also set `GIT_CONFIG_GLOBAL` to a path inside the sandbox (or `/dev/null`) so a future `XDG_CONFIG_HOME` leak cannot reach the real global config. Build the environment from scratch; never spread `process.env`.
- To give a scenario a stored credential, have its `Given` write `<sandbox home>/.gitconfig` with `credential.helper=store --file=<sandbox home>/.git-credentials`, plus a `https://user:token@127.0.0.1:<port>` line. Git rereads both files on every `git credential` spawn, so the setup is per scenario, and the `Before()` reset deletes it. Do not use `GIT_CONFIG_COUNT/KEY/VALUE` as the UAT canaries did: Pi's env is fixed at start, so that would apply the helper to every scenario in the worker.
- `_rpc.ts` is shared with `tests/e2e`. Extend it with an optional `extraEnv` (an allowlist the caller passes) rather than forking it. The new git-isolation variables are safe defaults for e2e too.

**Warning signs:**
A 401 scenario passes locally on Linux and fails on a macOS laptop, or the reverse. A 401 scenario takes 5 s (a helper is blocking until the credential timeout). `git credential` shows up in a process listing during a run.

**Phase to address:** RUN (env), SCENARIOS (credential `Given`).

---

### Pitfall 2: `GITHUB_BASE_URL` is wired into the clone URL only, so auth, leftover recovery, and update stay bound to github.com

**What goes wrong:**
The GitHub host and wire URL are hard-coded in **14 files**: `domain/{clone-key,source}.ts`, `orchestrators/auth-host.ts`, `orchestrators/marketplace/add.ts`, `platform/git.ts`, and nine `orchestrators/plugin/*` probes and flows. `orchestrators/marketplace/update.ts:398` also builds `` `https://github.com/${owner}/${repo}.git` `` inline, so a grep for `networkCloneUrl`/`GITHUB_HOST` misses it. If only `networkCloneUrl` honors the override:
- `hostFromCloneUrl(_, "github")` and `add.ts:974` still return `"github.com"`. The `onAuth` host guard compares the bound host `github.com` with the URL host `127.0.0.1:<port>` and **cancels before the helper is queried** (UAT test 8). So a 401 on a GitHub source always fails as `{authentication required}`. A GitHub Enterprise user with a stored credential could never authenticate.
- `originMatchesSource` (MA-12 leftover-clone recovery, `domain/clone-key.ts`) parses the recorded `origin`. Under the override that is `https://127.0.0.1:<port>/o/r.git`, which parses as kind `url`, not `github`. So `marketplace add` refuses its own leftover GitHub clone.
- `refreshGitHubClone` fetches from the clone's recorded `origin`, not from a freshly built URL. `marketplace update` therefore "works" under the override even when update's own wiring is missing. A scenario passes for the wrong reason, and a user who changes or unsets the variable keeps fetching from the old base.

**Why it happens:**
The happy-path clone scenario is the first one written, and it passes as soon as the wire URL changes. Every other GitHub-specific site is reached only by auth, recovery, or update scenarios.

**How to avoid:**
- Introduce one seam that returns `{ base URL, host }` for GitHub sources (default `https://github.com`, host `github.com`). Route all 14 sites and the inline literal through it. Then add a grep gate, or a `tests/architecture` source walk, that fails on a new `"github.com"` literal outside the seam and `auth-registry.ts`.
- Keep the source **identity** as `owner/repo`. Never store the override URL in `state.json` and never compare identities with it. Make `originMatchesSource` accept an origin under the configured base as the same GitHub repo.
- Bind auth to the override's `host:port`. `findProviderForHost("127.0.0.1:<port>")` returns `undefined`, so the bundle is `stored-credential` and Device Flow never runs. That is the correct and safe outcome (Pitfall 3).
- Write scenarios that only a complete wiring passes: a GitHub source behind a 401 with a stored credential (it must authenticate), leftover-clone recovery for a GitHub source, and `update` after `add`. Each asserts the stand-in's request log.

**Warning signs:**
A GitHub 401 scenario shows exactly one unauthenticated request and no authenticated retry. `rg 'github\.com' extensions/` returns sites the change did not touch.

**Phase to address:** OVERRIDE (seam, unit tests), SCENARIOS (the three proofs above).

---

### Pitfall 3: Device Flow fires against the real github.com and hangs the step

**What goes wrong:**
If the override leaves the bound host as `github.com` and the host guard is ever loosened (for example, to "fix" the auth cancel in Pitfall 2), `findProviderForHost("github.com")` returns `GITHUB_PROVIDER`. Its `deviceCodeUrl` and `tokenUrl` are literal `https://github.com/login/...`, and `initiateDeviceFlow` calls the global `fetch`. In RPC mode `ctx.mode` is `"rpc"`, not `"print"`, so `DeviceFlowUnavailableError` is not thrown. The extension emits a `device-flow-prompt` payload and polls github.com for up to the code's lifetime. `PI_OFFLINE=1` and `--offline` affect only Pi's own model and package fetches (`pi-coding-agent/dist/main.js:452`), not the extension's `fetch` or isomorphic-git. The scenario reaches the public network and blocks until the 30 s step timeout. Then the `Before()` hook replaces Pi, and the run gets 30 s slower.

**Why it happens:**
Device Flow is gated by host, not by environment. Overriding the clone base without the host makes `github.com` look like the target of a request that goes elsewhere.

**How to avoid:**
- Key Device Flow on the host actually contacted, which is the override's host (Pitfall 2). Under the override, Device Flow runs only when the override's host is `github.com` itself. Normalize `https://github.com`, `https://github.com/`, `https://www.github.com`, and `:443` the way `domain/source.ts` already does, and treat them as "unset".
- Treat Device Flow as out of scope for the suite, and say so in the feature description. It needs the GitHub OAuth endpoints, which no stand-in replaces.
- Never use `github.com` or `gitlab.com` URLs as **url** sources in a scenario that reaches the network. `gitlab.com` has its own Device Flow and is not covered by the override. A parse-level refusal scenario may name them only when parsing fails before any I/O.

**Warning signs:**
A `device-flow-prompt` payload appears (`runCommand` then fails on "exactly one payload"). A scenario sits at about 30 s. An `extension_error` mentions `fetch failed`.

**Phase to address:** OVERRIDE, SCENARIOS.

---

### Pitfall 4: The `GITHUB_BASE_URL` name is already in use, so "unset means unchanged" is false for real users

**What goes wrong:**
D-MF-01 justifies the divergence by saying it "changes nothing for a user who never sets it". The Terraform GitHub provider reads `GITHUB_BASE_URL` as its **API** endpoint. GitHub Enterprise users export values such as `https://ghe.example.com/api/v3/` in their shells and CI. The Elixir `git_store` library also reads it, with default `https://api.github.com`. A Pi user with that export would have every GitHub source cloned from `https://ghe.example.com/api/v3//owner/repo.git`, or from `https://api.github.com/owner/repo.git`. The clones fail, and nothing in the output points at an environment variable they set for another tool. Claude Code 2.1.296 has no such override, so the user's upstream experience never prepared them for it.

**Why it happens:**
The name was chosen for readability, without checking the ambient namespace.

**How to avoid:**
- Raise it with the user before OVERRIDE is planned. Per the project's upstream-parity constraint, a divergence beyond the recorded decision goes back to the user as a question. The likely fix is a project-prefixed name, such as `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, recorded as an amendment to D-MF-01.
- Whatever the name, validate the value once, at read time, with the same rules the source parser applies. Require `https://` (the parser rejects `http://`, and the GitHub arm builds its wire URL from `owner/repo` without re-parsing, so an `http://` override would otherwise reach isomorphic-git in cleartext). Reject userinfo (`https://user:token@host`), because the URL lands in rows and cause chains. Reject a query and a fragment. Strip one trailing slash, and keep a path prefix (`https://host/git` becomes `https://host/git/owner/repo.git`).
- An invalid value fails the command with a typed error that names the variable. It never falls back silently to github.com.

**Warning signs:**
A request path with `//` or `/api/v3/` in the stand-in log. The error rows show a URL the user never typed.

**Phase to address:** OVERRIDE (decision amendment, validation, unit tests for each refused form).

---

### Pitfall 5: The stand-in's port and CA are pinned into Pi's environment at start, but the code treats the server as a per-scenario fake

**What goes wrong:**
Node reads `NODE_EXTRA_CA_CERTS` once at process start. `GITHUB_BASE_URL` carries the port. Pi is started once per worker, so the server's port and CA must exist before `PiProcess.start` and must outlive every scenario in the worker. Three ways this breaks:
1. **Hook order.** Cucumber runs `BeforeAll`/`Before` hooks in load order, and `features/support/**/*.ts` loads alphabetically. A `support/git-server.ts` registers its hooks before `support/pi-process.ts`. That works by accident until a file is renamed. Its `Before()` would also reset the request log before `pi-process.ts` replaces a busy Pi, so the killed Pi's late request lands in the next scenario's log.
2. **Replacement.** `Before()` restarts a busy Pi with `PiProcess.start(run.sandbox)`. If the extra env is not part of the run record, the replacement Pi has no CA and no override. Every later GitHub scenario in that worker then goes to the real github.com, or fails TLS with a self-signed error.
3. **The cucumber rule.** `world-and-stand-ins.md` allows exactly one piece of module-level state: the slow process under test. A second module-level server is a review BLOCKER ("module-level state outside the slow-process exception").

**Why it happens:**
The skill's model is "a fake per scenario", and here a fake's identity (port and CA) is baked into the long-lived process.

**How to avoid:**
- Make the listener and CA part of the existing `PiRun` record in `support/pi-process.ts`: `{ root, sandbox, marketplacesRoot, gitServer, env, pi }`. One `BeforeAll` starts the server, then Pi with `env`. One `Before()` replaces Pi if busy (with the same `env`), **then** waits for the server's in-flight CGI children to drain, **then** resets the served repos, arming, and request log, **then** empties the sandbox. Asserting the reset should cover the server too: no repos, no arming, an empty log.
- The per-scenario state (repos, arming, log) belongs to the world. Steps reach it through the world, and releases go through `this.onRelease()`.
- Record the extension of the slow-process exception in `.agents/skills/cucumber/rules/world-and-stand-ins.md` in the same phase: "a stand-in whose address or trust the slow process fixes at start lives in the same run record". Otherwise every review will flag it.
- Never fix the problem with `NODE_TLS_REJECT_UNAUTHORIZED=0` or a plain-HTTP stand-in. The first turns off TLS checks for all of Pi and prints a warning on stderr. The second is refused by the parser anyway.

**Warning signs:**
GitHub scenarios fail only after an earlier scenario in the same worker timed out. A request appears in the log of a scenario that made none. Pi's stderr shows `Warning: Ignoring extra certs from ...` (the CA file is missing or was written after start).

**Phase to address:** RUN, STAND-IN.

---

### Pitfall 6: Scenarios that a wrong implementation still passes

**What goes wrong:**
This is the skill's first review question, and marketplace commands invite it in five places:
- **Network proof is missing.** `marketplace add owner/repo` is "added" whether the clone came from the stand-in, the real github.com (override not applied), or a leftover clone. Only the stand-in's request log tells them apart. In the same way, `list`, `info`, and `remove` must make **zero** requests (NFR-5), and nothing checks that unless a `Then` asserts an empty log.
- **Normalizing too much.** The result carries a random port and absolute temp paths: `marketplace-info.source.url`, `source.absPath` (unredacted by design, NFR-9), the row subject of a failed URL add, and `connect ECONNREFUSED 127.0.0.1:<port>` in cause chains. A projection that replaces any `127.0.0.1:\d+` or any `/tmp/...` with a placeholder also hides a request to the wrong port, or a path into the wrong scope.
- **Dropping fields.** `details.lastUpdatedAt` is a timestamp. Adding it to `UNSTATED_FIELDS` in `command.steps.ts` (next to `origin`) makes it disappear from every comparison, so a regression that stops stamping it, or stamps it on a failed update, passes.
- **Payload count is loose.** A bare `marketplace update` emits one payload per marketplace, in sorted order (`orchestrators/marketplace/update.ts:261-287`). It can also emit an extra `mcp-config-notices` payload. A driver that accepts "at least one" or "any order" lets a skipped marketplace through.
- **Kind is loose.** A driver that validates against the whole `NOTIFICATION_PAYLOAD_SCHEMA` union passes a `usage-error` where a `marketplace-info` was expected.

**Why it happens:**
Run-specific values force some normalization, and the easiest normalizer is a regex. Comparing whole results against tables pushes writers to drop the awkward fields.

**How to avoid:**
- Substitute **exact** run tokens only: the server's exact origin string, the exact sandbox and marketplaces roots. Replace them in both directions (in the command a step sends and in the result it projects) with named, visible placeholders. Document the placeholders once in each feature description (for example, "`<git server>` stands for the loopback HTTPS stand-in"). A value that contains a different port stays raw and fails the comparison.
- Compare `lastUpdatedAt` by property, not by dropping it: present and inside the window between the `When` starting and returning, or absent. Spell the expectation as a cell value such as `set by this update`.
- The driver takes the expected payload kind (and, for bare `update`, the expected count), validates against that kind's schema, and asserts the exact sequence of kinds.
- Give every network scenario a `Then the git server received these requests:` table (method, path, query, and whether it carried credentials, never the credential value). Give every `list`/`info`/`remove` scenario on a git source `Then the git server received no requests`.

**Warning signs:**
A projection helper containing `replace(/\d+/` or `/tmp`. A growing `UNSTATED_FIELDS`. A GitHub scenario with no request-log `Then`.

**Phase to address:** DRIVER (tokens, kinds, counts), SCENARIOS (request-log Thens), GATE (review against the skill's first question).

---

### Pitfall 7: Host git configuration leaks into the stand-in and the fixtures

**What goes wrong:**
The cucumber worker runs with the developer's real `HOME` and environment; only Pi is sandboxed. So `git init`, `git commit`, and `git http-backend` spawned from `features/lib/` read the real `~/.gitconfig` and `/etc/gitconfig`:
- `commit.gpgsign=true` makes fixture commits hang on pinentry or fail.
- `init.defaultBranch` makes HEAD `master` on one machine and `main` on another. Scenarios that show a ref, or that check out the default branch, then differ between laptop and CI.
- `/etc/gitconfig` here sets `filter.lfs.required=true`, and `transfer.hideRefs`, `uploadpack.*`, `core.hooksPath`, `safe.directory`, and `url.<base>.insteadOf` all change what `upload-pack` serves or what a commit does.
- Inherited `GIT_DIR`, `GIT_WORK_TREE`, or `GIT_INDEX_FILE` (set when anything runs under a git hook) make fixture commands operate **on this repository**.
- Commit SHAs change on every run unless author and committer dates are pinned.

**Why it happens:**
The spike ran on one machine with one config, and the stand-in reuses the worker's environment by default (`spawn` without `env`).

**How to avoid:**
Use one function in `features/lib/` that builds the git environment from scratch for **both** fixture commands and the CGI. Include: `PATH`, `HOME=<empty dir under the run root>`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, fixed `GIT_AUTHOR_NAME/EMAIL/DATE` and `GIT_COMMITTER_*`, and nothing else from `process.env`. Pass `-c init.defaultBranch=main` (or `git init -b main`) and `-c commit.gpgsign=false`. For the CGI, add only `GIT_PROJECT_ROOT`, `GIT_HTTP_EXPORT_ALL=1`, and the CGI variables from the request.

**Warning signs:**
A fixture `Given` passes locally and times out in CI, or the reverse. A ref column reads `master` on one machine. `git status` in the repository shows unexpected changes after a run.

**Phase to address:** STAND-IN.

---

### Pitfall 8: CGI wrapper edge cases crash the worker or hang the scenario

**What goes wrong:**
About 25 lines served the spike's happy path. The failure paths are where it breaks:
- **No timeout anywhere.** `platform/git.ts` sets no request timeout, and `simple-get` times out only when `opts.timeout` is set. If "drop the connection" is built as "accept and never answer", the command waits until the 30 s step timeout, then Pi is replaced. Each such scenario costs 30 s and leaves a busy Pi.
- **EPIPE kills the worker.** When the client or a drop arm closes the socket while `git http-backend` is still writing (or the wrapper is still writing to its stdin), an unhandled `'error'` on `child.stdin`/`child.stdout`/`res` throws. In a cucumber worker that ends every remaining scenario of that worker.
- **Header parsing.** `http-backend` prints `Status: 404 Not Found` only on errors. On success there is no `Status` line and the status is 200. Headers end at the first blank line (`\r\n\r\n`; also accept `\n\n`). That boundary can fall across two stdout chunks. The body is binary pack data and must never be decoded as text.
- **Request body.** isomorphic-git 1.42.3 buffers the upload-pack request so that it can send `Content-Length` (`index.cjs:10325`), and it never gzips request bodies. Pass `CONTENT_LENGTH` and `CONTENT_TYPE` through. If a request does arrive with `Content-Encoding: gzip`, pass it as `HTTP_CONTENT_ENCODING`; `http-backend` inflates it itself. Never decompress it in the wrapper.
- **Missing `QUERY_STRING`.** Without `service=git-upload-pack`, `http-backend` falls back to the dumb protocol and isomorphic-git fails with a confusing error.
- **Orphans.** A CGI child whose request was aborted keeps running unless it is killed on `req` `'close'`.
- **Wrong interface.** `server.listen(0)` with no host binds every interface. The skill requires loopback only.

**How to avoid:**
- Implement "drop" as an immediate `req.socket.destroy()`. Never offer a "hang" arm. If a stall is ever needed, it needs a client timeout first, and that is a production change.
- Attach `'error'` handlers to every stream. On `req` `'close'`, kill the child and settle the request's log entry.
- Parse with a small state machine: buffer until the blank line, split headers, take `Status`, then pipe the rest as raw bytes. Cover it with direct unit tests, because `features/lib/` code is otherwise exercised only end to end.
- Listen on `127.0.0.1` explicitly, use the literal `127.0.0.1` in URLs (`localhost` may resolve to `::1` first on some systems), and put `IP:127.0.0.1` in the certificate's subjectAltName. Node does not fall back to the CN for an IP host.
- Make the 401 arm answer with `WWW-Authenticate: Basic realm="..."`. Record whether each request carried `Authorization`, never its value.

**Warning signs:**
`Error: write EPIPE` in cucumber output followed by many failed scenarios from one worker. A scenario that takes about 30 s. `git-http-backend` processes left after a run.

**Phase to address:** STAND-IN.

---

### Pitfall 9: Asserting runtime-, platform-, and version-specific error text

**What goes wrong:**
Whole-result comparison forces the `cause chain` column into failure tables. The cause text for network failures comes from Node, OpenSSL, and isomorphic-git, and it drifts:
- Node 26 (the local `node`) appends the path to fs errno messages; Node 24 (CI) and 22 do not. This is memory `node-errno-message-drift-local-vs-ci`, PR #250. The suite runs under whatever `node` runs `npx`, and Pi runs under the same `process.execPath`, so local and CI produce different text.
- TLS wording changed between OpenSSL versions (`self signed certificate` vs `self-signed certificate`), and Node 24 and 26 bundle different OpenSSL versions.
- `connect ECONNREFUSED 127.0.0.1:<port>`, `socket hang up`, and `read ECONNRESET` depend on timing and carry the random port.
- The host has OpenSSL 4.0.3; ubuntu-latest has 3.0.x. CLI flags used to generate the certificate (`-nodes` vs `-noenc`, `-addext`) differ between them, and from LibreSSL on macOS (LOW confidence on the macOS details).

**How to avoid:**
- Use reasons (`authentication required`, `source missing`, ...) as the asserted behavior. Where a cause chain must appear, pin only messages the extension or isomorphic-git composes (`HTTP Error: 401 Unauthorized`, `NO_STORED_CREDENTIAL_CAUSE`). For runtime text, read the wording back from the runtime in the step (trigger the same failing call, as five unit suites already do), or substitute the exact port token (Pitfall 6).
- Do not write scenarios that depend on TLS failure text. The CA is trusted by design; a "bad certificate" scenario adds runtime-specific text and protects nothing in the extension.
- Generate the certificate with flags that both OpenSSL 3.0 and 4.x accept (`req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -noenc -days 1 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1`). Check the flags against `openssl version` on ubuntu-latest in the STAND-IN phase. Do not commit a key and certificate instead: the filesystem-mode TruffleHog hook flags private keys.
- Before pushing, run the suite once with `/usr/bin/node` (22) or a Node 24 binary.

**Warning signs:**
The behavioral CI job fails on a cause-chain cell while the local run passes. A cell contains `ECONN`, `socket`, or a port number.

**Phase to address:** DRIVER (read-back helpers), SCENARIOS, STAND-IN (openssl flags).

---

### Pitfall 10: Refused-form scenarios that would reach the public network if the parser regressed

**What goes wrong:**
Parse-level scenarios for `http://`, `ssh://`, `git@host:`, `/tree/` URLs, and bad shorthand usually use realistic hosts, such as `http://example.com/repo.git` or `git@github.com:o/r.git`. If a regression lets one of them through the parser, the scenario sends a real DNS lookup and connection before it fails. It may also fail for the wrong reason (`source missing`), which a loose `Then` accepts.

**How to avoid:**
- Point refused forms at the stand-in: `http://127.0.0.1:<port>/...`, `ssh://127.0.0.1:<port>/...`. A regression then shows up as a request in the log, or as a TLS client error on the HTTPS listener. Record `'tlsClientError'` and raw connections as attempts, and give these scenarios a `Then the git server received no requests`.
- Assert the exact `usage-error`/`failed` row, including the parser's message (`D-76-01` wording from `domain/source.ts:91`). The message comes from this extension, so it is stable.

**Phase to address:** SCENARIOS.

## Moderate Pitfalls

### Pitfall 11: Sandbox reset misses state outside the three sandbox directories

**What goes wrong:**
The `Before()` hook empties `home`, `agent`, and `project`. Marketplace clones (`<scopeRoot>/pi-claude-marketplace/...`) and `plugin-clones/` live inside those directories, so they are reset. The new pieces are not: served bare repos, the request log, and arming. Neither are the marketplace sources under `marketplacesRoot`, which today rely on each scenario's `onRelease`. Other leftovers carry state too: a timed-out scenario's in-flight `git http-backend`, and an armed 5xx left by a failed scenario that never reached its release. Because the run order is random, the leak shows up as a different flaky scenario on each run.

**How to avoid:**
The reset asserts emptiness of everything a scenario can create: no skills, no marketplaces (today), no served repos, an empty request log, no arming, and no CGI children. Keep `order: random`. Use a fresh repo name per scenario only if a scenario cannot be made independent otherwise; the reset should make that unnecessary.

**Phase to address:** RUN.

### Pitfall 12: In-process caches carry one scenario's manifest into the next command

**What goes wrong:**
`domain/manifest-cache.ts` keys entries by `(mtimeMs, size)` and documents that "a same-size rewrite within the filesystem's mtime resolution can collide". The existing fixture rewrites `"version":"1.0.0"` to `"1.1.0"`, which has the same size. Pi loads extensions with `moduleCache: false`, so `new_session` builds a fresh cache. Within one scenario, though, `add` followed by a rewrite and `update` uses one cache instance. On a filesystem with coarse timestamps (some CI overlay setups), `update` can read the stale manifest.

**How to avoid:**
Path-source update scenarios should change the manifest's size as well (for example `1.0.0` to `1.10.0`), or start a session between the rewrite and the `When`. Git-source scenarios are unaffected, because they reread from a fresh fetch.

**Phase to address:** SCENARIOS.

### Pitfall 13: Step text spelled to the rules, but the rules' gates are not wired

**What goes wrong:**
- `npm run test:cucumber` fails on undefined and ambiguous steps but **passes with unused ones**. `npx cucumber-js --dry-run --format usage` lists `UNUSED`, but nothing in `npm run check` or CI runs it. An abandoned step survives every gate.
- Ambiguity creeps in with generic parameters. `the marketplace {string} is added to the {word} scope` (path source) next to a new `the {word} marketplace {string} is added ...` can match the same text, or tempt a writer to fold the source kind into `{word}`, where `the github marketplace` and `the git marketplace` read alike.
- The rules require lower-case step text after the keyword, no `And`/`But`, every `Given` before the first `When`, and `Background:` with `Given` only. No linter checks any of them; only review does.
- `features/**` is under `npm run lint`, and fallow's `health` (cognitive complexity 15) and `dupes` (threshold 3) also see it. A CGI parser or a projection helper written as one function trips the complexity gate. Parallel table projections in several step modules trip dupes.

**How to avoid:**
Add a script (for example `test:cucumber:usage`) that runs the dry-run usage report and fails on `UNUSED`, and chain it into `check:static` or the behavioral CI job. A small source walk for `^\s*(And|But) ` and upper-case step text in `features/**/*.feature` is cheap and worth having. Name source kinds in fixed phrases ("a local directory", "a git repository served over https", "the github repository") rather than `{word}`.

**Phase to address:** GATE (first phase that adds a step), SCENARIOS.

### Pitfall 14: The driver's `assertQuiet` and single-payload rule do not fit marketplace commands

**What goes wrong:**
`runCommand` asserts exactly one `cascade` payload, no dialogs, and no extension errors. Marketplace commands emit `marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added`, and `usage-error`. A bare `update` emits one payload per marketplace. `remove` and `update` may add a cascade onto installed plugins, and possibly `mcp-config-notices`. Loosening `runCommand` in place weakens the existing plugin scenarios.

**How to avoid:**
Keep `runCommand` strict. Add `runCommandExpecting(pi, command, kinds: readonly Kind[])`, which validates each payload against its own kind's schema and returns them in order, with the generic `When the user runs {string}` steps passing the expected kinds through a typed `Then` (the `Then` names what it reads: `the result is the marketplace info:`). Keep `assertQuiet` everywhere.

**Phase to address:** DRIVER.

### Pitfall 15: `npm run check` and the behavioral CI job get slower than they look

**What goes wrong:**
Today the suite runs 13 scenarios in 4.8 s wall time on 28 cores (measured 2026-10-15). `npm run check` already takes about 73 s and runs cucumber serially between integration and direct coverage. ubuntu-latest has 4 vCPUs. With `parallel: 8`, eight Pi processes, eight servers, and per-request `git http-backend` spawns oversubscribe it. The `behavioral` job has a 10-minute timeout, and a few 30 s step timeouts (Pitfall 8) or Pi replacements multiply quickly.

**How to avoid:**
Budget each git scenario at under 1 s locally. Keep `drop` immediate. Build each fixture repo once per scenario, with one commit (a pack, not many loose objects; `/tmp` is a 1M-inode tmpfs, memory `tmp-inode-exhaustion-enospc`). Measure the job's duration in CI at the end of STAND-IN and again at the end of SCENARIOS. Consider `parallel: 4` on CI if it is faster there. Note that the pre-commit `npm-check` hook runs `check:commit`, which does **not** run cucumber. A features-only commit is green at commit time and can still fail `npm run check`.

**Phase to address:** GATE, STAND-IN.

## Minor Pitfalls

### Pitfall 16: `lastUpdatedAt`, SHAs, and refs differ per run

Fixture commits without pinned dates produce new SHAs on every run, and `lastUpdatedAt` is wall-clock time. Pin the dates (Pitfall 7) and compare timestamps by window (Pitfall 6).

### Pitfall 17: The run root can land in a place the sandbox check refuses

`_rpc.ts::resolveSandbox` refuses sandbox locations inside the repository or outside `realpath(tmpdir())`. The served repos and CA file have no such check. Keep them under the same `mkdtemp` run root, so `AfterAll` removes everything in one `rm`. A crashed worker leaves `pi-cm-features-*` behind; find and clean those when `/tmp` inodes run low.

### Pitfall 18: Credential-carrying redirects in stand-in arming

`platform/git.ts` follows redirects itself and drops credentials across origin (scheme, host, port), as fixed in any-git-host G-01-4. If the stand-in grows a "redirect" arm, keep every target on loopback (another `127.0.0.1` port). A redirect to a public host would leave the machine.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Regex normalization of ports and temp paths in the projection | One helper replaces every run-specific value | Hides wrong-port and wrong-scope regressions (Pitfall 6) | Never; substitute exact run tokens |
| Adding `lastUpdatedAt` to `UNSTATED_FIELDS` | Tables stay static | A dropped or wrong timestamp passes | Never; compare by window |
| Spreading `process.env` into the CGI or Pi env | Fewer variables to list | Host git config and credentials leak (Pitfalls 1, 7) | Never |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` instead of a CA | No openssl dependency | Turns off TLS checks for all of Pi, warns on stderr, and can hide a real TLS regression | Never |
| Overriding only `networkCloneUrl` | The happy-path scenario passes on day one | Auth, recovery, and update stay on github.com (Pitfall 2) | Never |
| A separate module-level server outside `PiRun` | Matches the "one module per stand-in" layout | Breaks the slow-process rule, hook order, and replacement env (Pitfall 5) | Never; extend `PiRun` and amend the rule |
| Committing a fixed test certificate | Avoids openssl in CI | TruffleHog flags the key, and the certificate expires | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `git http-backend` | Missing `GIT_HTTP_EXPORT_ALL`, `QUERY_STRING`, or `GIT_PROJECT_ROOT`; inheriting the worker env | Build the CGI env from scratch; pass `CONTENT_LENGTH`/`CONTENT_TYPE`/`HTTP_CONTENT_ENCODING` through |
| `git credential` (spawned by the extension) | Relying on sandboxed `HOME` alone | `GIT_CONFIG_NOSYSTEM=1` plus `GIT_CONFIG_GLOBAL` in the Pi env; a per-scenario `.gitconfig` with `credential.helper=store` |
| `NODE_EXTRA_CA_CERTS` | Writing the CA after Pi starts; forgetting it on Pi replacement | Generate before `PiProcess.start`; keep the env on `PiRun` |
| Device Flow (`domain/github-auth.ts`) | Leaving the bound host `github.com` under the override | Bind to the override's `host:port`; no provider means no Device Flow |
| isomorphic-git over a stalled socket | Arming a "hang" | Destroy the socket; there is no client timeout |
| Cucumber hooks | Two support modules with order-dependent `Before()` hooks | One `Before()` in `support/pi-process.ts` sequences replace, drain, reset |
| `localhost` | Using the name in URLs and the certificate | Literal `127.0.0.1` and an `IP:` SAN |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Stall-type failure arms | About 30 s per scenario, Pi replaced | Immediate `socket.destroy()` | First scenario that uses it |
| Oversubscribed CI runner | Behavioral job near its 10-minute timeout | Measure; consider `parallel: 4` on CI | About 60+ git scenarios on 4 vCPUs |
| Loose-object fixtures | `/tmp` inode exhaustion, ENOSPC on `mkdtemp` | One commit per repo; clean the run root | Repeated local runs with crashed workers |
| Helper timeout on 401 | 5 s per auth challenge | Isolate git config so `fill` misses fast | Any machine with a slow system helper |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reaching the system credential helper from a scenario | Reads, or with `reject` erases, a developer's real credential | Pitfall 1 isolation |
| Accepting `http://` or userinfo in the override | Cleartext credentials; a token echoed into rows and cause chains | Validate the override at read time (Pitfall 4) |
| Binding the stand-in to all interfaces | Exposes the test git server to the LAN during runs | `listen(0, "127.0.0.1")` |
| Logging `Authorization` values in the request log | Test credentials in CI logs; a habit that copies to real canaries | Record presence only |
| Loosening the `onAuth` host guard to make GitHub 401 scenarios pass | Reopens the cross-host credential leak fixed in any-git-host | Fix the bound host instead (Pitfall 2) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| A stray `GITHUB_BASE_URL` (Terraform) silently redirects clones | Every GitHub marketplace fails with a confusing URL | Project-prefixed name, or validation that names the variable (Pitfall 4) |
| An invalid override falls back to github.com | The user thinks the override works and is cloning from public GitHub | Fail with a typed error that names the variable |
| The override changes after `add` | `update` keeps fetching from the old base (it uses the clone's recorded origin) | Document this, or re-point `origin` when the base changes; decide in OVERRIDE |

## "Looks Done But Isn't" Checklist

- [ ] **Override:** every one of the 14 files plus `marketplace/update.ts:398` goes through one seam. Verify with `rg 'github\.com' extensions/`.
- [ ] **Override:** a GitHub 401 with a stored credential authenticates. Verify that the request log shows an unauthenticated then an authenticated request.
- [ ] **Hermeticity:** a scenario run with `credential.helper=!echo LEAK` in a throwaway `/etc/gitconfig` (or a temp `GIT_CONFIG_SYSTEM`) never sees it. This is a negative control run once by hand, not committed (the repo's "a gate's run over the real tree is its only committed proof" rule).
- [ ] **NFR-5:** every `list`/`info`/`remove` scenario on a git source asserts an empty request log.
- [ ] **Reset:** the `Before()` assertion covers repos, log, arming, and CGI children, not only skills and marketplaces.
- [ ] **Replacement:** a scenario that times out mid-clone leaves the next scenario in that worker green (force one by hand once).
- [ ] **Unused steps:** the dry-run usage report shows no `UNUSED`, and a script enforces it.
- [ ] **Node 24:** the suite passes under Node 24, not only the local Node 26.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Real credential erased by `reject` | HIGH (user data) | Re-store it with `git credential approve`; then add the env isolation before any further run |
| Override wired partially | MEDIUM | Introduce the seam, route the remaining sites, add the grep gate |
| Stand-in crashes a worker (EPIPE) | LOW | Add the stream error handlers; rerun |
| Flaky reset leak | MEDIUM | Run the suite with `--order random:<seed>` from the failing CI log to reproduce; extend the reset assertion |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Credential helper leak | RUN | Negative control with a planted system helper; scenarios pass on a clean sandbox |
| 2 Partial override wiring | OVERRIDE | `rg` shows one seam; GitHub 401, recovery, and update scenarios |
| 3 Device Flow to github.com | OVERRIDE | Unit test: an override host gets a `stored-credential` bundle |
| 4 Name collision and validation | OVERRIDE (user decision first) | Unit tests for `http://`, userinfo, trailing slash, path prefix, API-style value |
| 5 Server lifetime vs Pi env | RUN, STAND-IN | One `PiRun`; amended cucumber rule; forced-timeout check |
| 6 Wrong implementation passes | DRIVER, SCENARIOS | Review question 1 on every feature; request-log Thens |
| 7 Host git config in fixtures/CGI | STAND-IN | Run with a hostile `~/.gitconfig` (gpgsign, defaultBranch=master) once by hand |
| 8 CGI edge cases | STAND-IN | Direct unit tests of the header parser; drop-arm scenario under 1 s |
| 9 Runtime-specific text | DRIVER, SCENARIOS | Suite passes under Node 24 and Node 26 |
| 10 Refused forms reaching the network | SCENARIOS | Empty request log in each refusal scenario |
| 11 Reset gaps | RUN | Extended reset assertion; random order |
| 12 Manifest cache collision | SCENARIOS | Version rewrites change the size |
| 13 Unused or ambiguous steps | GATE | Usage script in the gate |
| 14 Driver payload kinds | DRIVER | Plugin scenarios stay green with strict `runCommand` |
| 15 Check duration | GATE | CI job time recorded at two checkpoints |

## Sources

- In-tree source, read 2026-10-15: `tests/e2e/_rpc.ts` (`childEnvironment`, `resolveSandbox`), `features/**`, `extensions/pi-claude-marketplace/{orchestrators/auth-host.ts, domain/auth-registry.ts, domain/source.ts, domain/clone-key.ts, domain/manifest-cache.ts, orchestrators/marketplace/add.ts, orchestrators/marketplace/update.ts, platform/git.ts, platform/git-credential.ts, shared/redact-absolute-paths.ts, shared/notification-wire.ts}`. HIGH.
- `node_modules/isomorphic-git` 1.42.3 (`index.cjs:10325`, buffered upload-pack body with Content-Length, no request gzip) and `node_modules/simple-get/index.js:74` (timeout only when set). HIGH.
- `node_modules/@earendil-works/pi-coding-agent/dist/main.js:452` (`PI_OFFLINE` scope) and `core/extensions/loader.js:473` (`moduleCache: false`). HIGH.
- `.planning/milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-phases/01-private-repos-on-any-git-host/01-UAT.md` (credential helper via `GIT_CONFIG_*`, host guard, the port-redirect leak G-01-4, the Device Flow debug wording for non-registry hosts) and `02-.../02-UAT.md` (verbatim-only endpoint canary with `NODE_EXTRA_CA_CERTS`). HIGH.
- Claude Code 2.1.296 binary grep: GitHub clone URL literals `https://github.com/${repo}.git`; no `GITHUB_BASE_URL`. HIGH.
- Project memory: `ci-race-test-flake-cluster`, `tmp-inode-exhaustion-enospc`, `node-errno-message-drift-local-vs-ci`, `subagent-tests-must-use-hermetic-home`, `green-runs-that-checked-nothing`, `dont-test-what-a-gate-already-guards`, `live-canary-scratch-engine-route`. HIGH (project-recorded).
- `GITHUB_BASE_URL` in other tools: [Terraform GitHub provider docs (mirror)](https://docs.w3cub.com/terraform/providers/github/index), [GHE commit setting it to `/api/v3/`](https://github.e.it.census.gov/CSVD/ghe-runners/commit/aaf9b61ea5acac4176a4167ffc35593bfac0f0b0), [Elixir git_store config](https://git-store.hexdocs.pm/1.0.0/git_store/github_config.html), [Codespaces default env vars (`GITHUB_SERVER_URL`/`GITHUB_API_URL`)](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace). MEDIUM.
- Local host facts: `/etc/gitconfig` present (git-lfs filters, `filter.lfs.required=true`), git 2.55.0, OpenSSL 4.0.3, `/usr/libexec/git-core/git-http-backend`; current suite 13 scenarios in 4.8 s wall. HIGH for this machine only.

---
*Pitfalls research for: marketplace behavioral tests (marketplace-features)*
*Researched: 2026-10-15*
