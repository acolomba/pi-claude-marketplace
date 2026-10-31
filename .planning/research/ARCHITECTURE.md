# Architecture Research

**Domain:** Behavioral (cucumber) test suite for `/claude:plugin marketplace`, driven through a real headless Pi in RPC mode, plus one production seam (`GITHUB_BASE_URL`, D-MF-01)
**Milestone:** marketplace-features
**Researched:** 2026-10-15
**Confidence:** HIGH for integration points and boundaries (read from the code on this branch). HIGH for `NODE_EXTRA_CA_CERTS` timing (quoted from the Node CLI docs). MEDIUM for the git-host CGI details: the spike proved them, but they have not yet run inside Pi's `--offline` RPC child.

## Standard Architecture

### System Overview

```
cucumber worker (one of 8, random order)
┌────────────────────────────────────────────────────────────────────────────┐
│ step_definitions/                                                            │
│   command.steps.ts      marketplace/*.steps.ts    config.steps.ts            │
│   session.steps.ts      git-host.steps.ts                                    │
│        │ this.pi / this.gitHost / this.results (ScenarioWorld)               │
├────────┼────────────────────────────────────────────────────────────────────┤
│ support/world.ts      (fresh world per scenario, onRelease, After)           │
│ support/pi-process.ts (the run's ONLY module state: PiRun)                   │
│   BeforeAll: mkdtemp root -> start HttpsGitHost -> start Pi(env)             │
│   Before:    host.reset() + empty sandbox + new_session + assert all empty   │
│   AfterAll:  stop Pi -> stop host -> rm root                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ lib/ (registers nothing)                                                     │
│   pi-process.ts     PiProcess (JSONL, one request at a time)                 │
│   pi-commands.ts    runCommand (1 cascade) + runCommandPayloads (all, union) │
│   path-marketplace.ts  (existing fixture: directory + marketplace.json)      │
│   git-marketplace.ts   NEW fixture: commit a marketplace into a bare repo    │
│   https-git-host.ts    NEW fake: node:https -> `git http-backend` CGI        │
│        ▲ https://127.0.0.1:<port>/<owner>/<repo>.git                         │
└────────┼────────────────────────────────────────────────────────────────────┘
         │ isomorphic-git clone/fetch (trusts the cert via NODE_EXTRA_CA_CERTS)
┌────────┴────────────────────────────────────────────────────────────────────┐
│ Pi child (tests/e2e/_rpc.ts startRpcPi; env = allowlist + run-fixed extras)  │
│   HOME, PI_CODING_AGENT_DIR, PI_OFFLINE, PATH                                │
│   + NODE_EXTRA_CA_CERTS=<root>/git-host/cert.pem                             │
│   + GITHUB_BASE_URL=https://127.0.0.1:<port>  (name: see Open Decision 1)    │
│   + GIT_CONFIG_NOSYSTEM=1                                                    │
│   extension: domain/clone-key.ts ─┐                                          │
│              orchestrators/auth-host.ts ─┼─> shared/github-base-url.ts (NEW) │
│              marketplace/add.ts, update.ts, plugin/update-flow.ts ─┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | New / Modified | Responsibility |
|-----------|----------------|----------------|
| `features/lib/https-git-host.ts` | NEW | A loopback-only `node:https` server. It writes a run-time openssl key and certificate (SAN `IP:127.0.0.1`), runs `git http-backend` as a CGI per request against a repos root, records each request (method, path, service, status), can be armed per repo to answer 401, 404, 5xx, or drop the connection, and exposes `reset()` and `stop()`. |
| `features/lib/git-marketplace.ts` | NEW | A fixture that creates `<reposRoot>/<owner>/<repo>.git` as a bare repo. It reuses `path-marketplace.ts` to write the tree and commits it with `git --git-dir=<bare> --work-tree=<tmp>` in a hermetic git env. Committing again publishes an update. |
| `features/lib/path-marketplace.ts` | unchanged (maybe a `writeManifestOnly` variant) | Writes a directory marketplace. The direct-`marketplace.json` source points at `<root>/.claude-plugin/marketplace.json` of the same tree. |
| `features/lib/pi-commands.ts` | MODIFIED | Adds `runCommandPayloads()`. It validates every `claude-plugin` entry against `NOTIFICATION_PAYLOAD_SCHEMA` and returns all of them. `runCommand()` becomes "exactly one payload, of kind `cascade`", built on top of it, so the plugin steps do not change. |
| `features/lib/pi-process.ts` | unchanged | Already collects every entry per request. |
| `tests/e2e/_rpc.ts` | MODIFIED (small) | `startRpcPi(sandbox, extraEnv?)`. Explicit extra keys are merged after the allowlist. There is still no `process.env` passthrough. Today it is used only by `features/`. |
| `features/support/pi-process.ts` | MODIFIED | `PiRun` gains `gitHost`. BeforeAll starts the host before Pi and passes its env. Before resets the host and asserts it empty: no repos, nothing armed, no requests. That reset doubles as an NFR-5 check, because the reset's own `/claude:plugin list` must reach no network. A replaced Pi reuses the same env. |
| `features/support/world.ts` | MODIFIED | `results: NotificationPayload[]`. `lastResult()` asserts exactly one payload. Adds getters `gitHost` and `configPath(scope)`. Optional rename `PluginWorld` -> `ScenarioWorld`. |
| `features/step_definitions/marketplace/*.steps.ts` | NEW (split of `marketplace.steps.ts`) | Publishing marketplaces (directory, manifest file, git host, GitHub `owner/repo`) and reading marketplace-shaped results (list blocks, info, info-cascade, not-added). |
| `features/step_definitions/git-host.steps.ts` | NEW | Arming the host (`the git host answers 401 for "acme/tools"`) and asserting what it received (`the git host receives no requests`). |
| `features/step_definitions/config.steps.ts` | NEW | Reads the user-owned `claude-plugins.json` of a scope and compares its whole `marketplaces` map. |
| `features/step_definitions/command.steps.ts` | MODIFIED | `When the user runs` stores all payloads. Adds a usage-error step. Expands the host token in commands and projects it back in result cells. |
| `features/marketplace/{add,remove,list,info,update,autoupdate}.feature` | NEW | One feature per verb. Usage errors and refused source forms go into the verb whose parser refuses them. |
| `extensions/.../shared/github-base-url.ts` | NEW (production) | `gitHubBaseUrl(): string`. Reads the env var on every call and holds no state (the `workflow-home.ts` / `debug-log.ts` precedent). Unset or empty returns `https://github.com`. |
| `extensions/.../domain/clone-key.ts` | MODIFIED | The `github` arm of `canonicalCloneUrl` builds `${gitHubBaseUrl()}/${owner}/${repo}`. Identity, wire URL (`networkCloneUrl`), and `originMatchesSource` then all follow from one seam. |
| `extensions/.../orchestrators/auth-host.ts` | MODIFIED | The `GITHUB_HOST` constant becomes `gitHubHost()` (`new URL(gitHubBaseUrl()).host`). The `github` arm of `hostFromCloneUrl` returns it. |
| `orchestrators/marketplace/add.ts:974`, `orchestrators/plugin/update-flow.ts:151`, `orchestrators/marketplace/update.ts:398-401` | MODIFIED | Replace the `GITHUB_HOST` literal and the hand-built `https://github.com/...` URL with `gitHubHost()` / `networkCloneUrl(source)`. |

## Recommended Project Structure

```
features/
├── marketplace/                     # NEW function dir: .feature files only
│   ├── add.feature                  # every source kind + refused forms (Outline) + usage errors
│   ├── remove.feature               # incl. the cascade onto installed plugins
│   ├── list.feature
│   ├── info.feature                 # single + fan-out (marketplace-info-cascade) + not-added
│   ├── update.feature               # single, bare (one payload per marketplace), armed failures
│   └── autoupdate.feature           # autoupdate / noautoupdate
├── plugin/                          # existing, untouched
├── step_definitions/
│   ├── command.steps.ts             # run a command, read the generic envelope (modified)
│   ├── config.steps.ts              # NEW: claude-plugins.json of a scope
│   ├── git-host.steps.ts            # NEW: arm the host, read its request log
│   ├── session.steps.ts             # existing
│   └── marketplace/                 # SPLIT of marketplace.steps.ts (layout.md "a module that grows")
│       ├── publishing.steps.ts      # "the marketplace X offers these plugins" (dir / git host / github)
│       └── results.steps.ts         # "the result lists these marketplaces:", info, not-added
├── support/
│   ├── pi-process.ts                # PiRun = sandbox + Pi + git host (modified)
│   └── world.ts                     # modified
└── lib/
    ├── https-git-host.ts            # NEW fake
    ├── git-marketplace.ts           # NEW fixture
    ├── path-marketplace.ts          # existing fixture
    ├── pi-commands.ts               # modified driver
    └── pi-process.ts                # existing
```

### Structure Rationale

- **No `features/lib/github*.ts`.** GitHub is not a second server. It is a path layout (`/<owner>/<repo>.git`) on the same host, chosen so `canonicalCloneUrl` maps `owner/repo` straight onto it. URL-source scenarios use the same layout, so one fixture (`git-marketplace.ts`) publishes for both, and a step such as `the marketplace "tools" is published at github as "acme/tools"` only picks the owner/repo. A separate GitHub module would duplicate the fixture and break layout.md's rule to "name the kind, not the role".
- **`https-git-host.ts`, not `git-server.ts` or `http-backend.ts`.** layout.md says to name the kind. An ssh or plain-http host would be another kind. `http-backend` names the implementation, not what it stands in for.
- **Split `marketplace.steps.ts` now.** It gains about four publishing variants and four result shapes. layout.md says a module that grows becomes `step_definitions/<function>/<topic>.steps.ts`. The existing two `Given`s move to `publishing.steps.ts` unchanged.
- **`config.steps.ts` is its own function.** `claude-plugins.json` is the user's declarative config: it declares plugins and marketplaces both, so it is neither the plugin nor the marketplace vertical.
- **The host's lifetime lives in `support/pi-process.ts`, not in a `support/https-git-host.ts`.** Cucumber runs `BeforeAll` hooks in load order, and the host must be listening before Pi spawns. Two modules would also mean two pieces of module state, which world-and-stand-ins.md forbids.

## Architectural Patterns

### Pattern 1: Run-fixed stand-in, per-scenario reset (the host rides on PiRun)

**What:** One `HttpsGitHost` per worker, started in `BeforeAll` before Pi and stored on the existing `PiRun`. The certificate path and the port are written into Pi's env once. Per-scenario state is the repos root, the arming table, and the request log. `Before()` clears all three and asserts they are clear, just as it already empties the sandbox.

**Why this lifetime and not per scenario:**
- `NODE_EXTRA_CA_CERTS` "is only read when the Node.js process is first launched. Changing the value at runtime ... has no effect" (Node CLI docs). If the file is missing at launch, Node only warns, and every clone then fails as self-signed. So the certificate must exist before Pi spawns and must outlive scenarios.
- `GITHUB_BASE_URL` contains the port. Per-scenario servers would need the same port every time, and with 8 parallel workers, TIME_WAIT, and random order that is not reliable. The variable is fixed at Pi start, so the port is too.
- A hybrid (run-level host for GitHub sources, per-scenario hosts for URL sources) means two lifetimes, two reset paths, and two sets of arming code for no extra coverage.

**Rule change required.** world-and-stand-ins.md allows module state only for "a process under test that is too slow to start per scenario". The host is neither the process under test nor slow. Its lifetime is forced because the slow process pins its address and trust root. Amend the exception, for example: *"A stand-in whose address or trust root that process fixes when it starts lives in the same run state; the same `Before()` resets it and asserts it is empty."* This is a skill-rule edit, so it needs the user's approval (Open Decision 2).

**Trade-off:** Arming is mutable state that crosses scenarios, but only through `PiRun`, and the reset asserts it is empty. A leak shows up under `order: random` as a reset failure, not as a wrong result.

```typescript
// support/pi-process.ts (shape only)
BeforeAll(async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-features-"));
  const gitHost = await HttpsGitHost.start(path.join(root, "git-host"));
  const sandbox = { home: ..., agentDir: ..., cwd: ... };
  piRun = { root, sandbox, gitHost, pi: await PiProcess.start(sandbox, gitHost.piEnvironment()) };
});

Before(async (): Promise<void> => {
  const run = currentRun();
  if (!run.pi.idle) { await run.pi.stop(); run.pi = await PiProcess.start(run.sandbox, run.gitHost.piEnvironment()); }
  await run.gitHost.reset();                 // rm repos, disarm, clear log
  /* empty sandbox, new_session, list */
  assert.deepStrictEqual(
    { skills, marketplaces: listed.marketplaces, gitHostRequests: run.gitHost.requests() },
    { skills: [], marketplaces: [], gitHostRequests: [] },
  );
});
```

### Pattern 2: Widened driver, narrowed by kind at the step

**What:** `runCommandPayloads(pi, command)` asserts the exchange was quiet (no extension errors, no dialogs) and `disposition: "handled"`. It validates every `claude-plugin` entry with `Compile(NOTIFICATION_PAYLOAD_SCHEMA)` (`shared/notification-wire.ts:800`), asserts there is at least one, and returns `NotificationPayload[]` in emission order. `runCommand` stays the strict single-cascade wrapper for setup `Given`s. Steps narrow on `kind` with an assertion that compares whole values, never with a silent filter.

**When:** Every marketplace `When`. A bare `marketplace update` emits one cascade per marketplace. Any mutating command can add an `mcp-config-notices` payload. `info` emits `marketplace-info`, `marketplace-info-cascade`, or `marketplace-not-added`. The parser emits `usage-error`.

**World shape:** `results: NotificationPayload[] | undefined`. `lastResult()` asserts `results.length === 1` and returns it. The existing `the result has these fields:` step works for any kind once `UNSTATED_FIELDS` also hides `blocks` (it already hides `marketplaces`), because `flatten` already folds `source.sourceKind` to `source kind`. Bare `update` gets its own step, `the results list these marketplaces:`, which flattens the `marketplaces` blocks of every cascade payload in order. Verify the per-marketplace emission order is deterministic (sorted by name?) before writing an ordered table.

```typescript
export type NotificationPayload = Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;
const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

export async function runCommandPayloads(pi: PiProcess, command: string): Promise<NotificationPayload[]> {
  const exchange = await pi.request({ type: "prompt", message: command });
  assertQuiet(exchange);
  assert.deepStrictEqual(exchange.response.data, { disposition: "handled" }, command);
  const payloads = exchange.entries.filter((e) => e.customType === "claude-plugin").map((e) => e.data);
  for (const payload of payloads) {
    assert.ok(PAYLOAD_VALIDATOR.Check(payload), JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)));
  }
  assert.notDeepStrictEqual(payloads, [], command);
  return payloads as NotificationPayload[]; // after Check; or narrow via a type guard
}
```

(`as` after a `Check` is a test-side cast. If lint objects, use a type-guard function, as `CASCADE_VALIDATOR.Check` already narrows today.)

### Pattern 3: Symbolic addresses in step text, exact values in assertions

**What:** Steps never name temp paths or the port (features.md). Two run-specific values appear in what users type and see:
- **Path sources:** place local marketplaces under the sandbox HOME and type them as `~/marketplaces/<name>`. `~/` parses as a path source (`domain/source.ts:348`). Pi expands it against the sandbox HOME, and `claude-plugins.json` records the user-typed form verbatim (`config-write-back.ts` source contract). So a config table reads exactly `~/marketplaces/fixtures`. For `marketplace-info.source.absPath`, the result step projects the sandbox HOME prefix back to `~`, so the comparison stays whole-value.
- **Git URLs:** one token, for example `https://<git host>/acme/tools.git`, expanded by `command.steps.ts` before sending. Actual result cells, such as a cause chain that names the URL, are projected back with the reverse substitution. Put both directions in `lib/https-git-host.ts` (`expandAddress`, `projectAddress`). Do not use `<...>` if any Outline has a column of the same name, because Outline substitution runs first. A different sigil is safer; the writer picks it.
- **GitHub sources need no token.** `owner/repo` and `https://github.com/owner/repo` are typed literally. That is the point of the override.

**Trade-off:** Projecting results risks hiding a bug that writes the wrong host. Mitigation: the projection replaces only the exact run base `https://127.0.0.1:<port>`, so any other host still shows up and fails the comparison.

### Pattern 4: One production seam for the GitHub base (D-MF-01)

**What:** `shared/github-base-url.ts` exports `gitHubBaseUrl()`. `canonicalCloneUrl`'s `github` arm reads it, and a `gitHubHost()` derived from it replaces the `GITHUB_HOST` constant. Every downstream path then follows with no other edits: `networkCloneUrl` (marketplace add, plugin clone, `install-clone-probe`, `dependency-tag-probe`), `originMatchesSource` (MA-12 leftover recognition), and plugin-clone cache keys.

**Why `canonicalCloneUrl` and not only the wire URL:** If only `networkCloneUrl` changed, a clone's recorded `origin` would be the stand-in URL while the source identity stayed `github.com`. `originMatchesSource` would then reject the extension's own leftover (MA-12/MA-13), and `hostFromCloneUrl` would still bind `github.com`. `buildAuthCallbacks.onAuth` compares `new URL(url).host` with the bound host (`platform/git-auth-callbacks.ts:178`) and cancels on a mismatch, so every 401 path would fail with a host-mismatch instead of the real behavior. Unset, the identity string stays byte-identical, so warm caches are untouched.

**Why the host must come from the base (security):** If the wire URL moved to the override host while auth stayed bound to `github.com`, the `credentialOps.fill("github.com")` result would be keyed to github.com. The `onAuth` host guard cancels before offering it, but that guard is the only thing that keeps a GitHub token from being sent to another origin. Binding auth to the override host makes the helper lookup itself host-correct. It also means `findProviderForHost(127.0.0.1:<port>)` finds no provider, so the Device Flow can never fire under the override. Without that, `domain/github-auth.ts` would `fetch` the real `github.com/login/device/code` from a hermetic test, which breaks the "no network" rule.

**What does NOT follow the override:** `sourceLogical` (the `marketplace list` label and the same/different source compare), the `marketplace-info` GitHub `owner`/`repo` fields, `claude-plugins.json` (raw user input), the `github.com` host fold in `source.ts` parsing, and `auth-registry.ts`'s `github.com` provider. Users keep seeing GitHub, which keeps parity.

**Boundary placement:**
- `domain` may import only `shared` and `platform` (`.fallowrc.json`). `shared` is a leaf and already reads an extension-owned env var (`shared/debug-log.ts`).
- **Do not put it at `platform/github-*.ts`.** ESLint BLOCK F's `no-restricted-imports` regex is the bare substring `platform/git` (`eslint.config.js:379`). It would match `platform/github-base-url.ts` and fail `domain/clone-key.ts`, which is not in `NETWORK_SEAMS`, and so is every other network-free importer.
- The module names no `gitOps`, so it does not belong in `NETWORK_SEAMS`.
- No fallow rule-pack rule bans `process.env` reads.

## Data Flow

### Scenario flow (`marketplace add` of a git URL)

```
Given the marketplace "tools" is published at the git host as "acme/tools"
  git-marketplace.ts: writeMarketplace(tmp) -> git init --bare <repos>/acme/tools.git
                      -> git --git-dir --work-tree add/commit (hermetic env)
When the user runs "/claude:plugin marketplace add https://<host>/acme/tools.git --scope project"
  command.steps.ts: expandAddress -> runCommandPayloads(pi, cmd)
    Pi child: edge/router -> orchestrators/marketplace/add.ts -> addUrlInGuard
      -> hostFromCloneUrl(url) = 127.0.0.1:<port> -> buildAuthForHost
      -> gitOps.clone(networkCloneUrl) ==HTTPS==> HttpsGitHost
           (arming check -> spawn git http-backend CGI -> record request)
      -> rename into <project>/.pi/pi-claude-marketplace/sources/tools
      -> write-back <project>/.pi/claude-plugins.json {source: raw}
      -> pi.appendEntry("claude-plugin", cascade)
    PiProcess collects entries until the response -> validated union payloads
  world.results = [cascade]
Then the result lists these marketplaces:     (payload, user-visible)
Then the project config declares these marketplaces:  (claude-plugins.json, user-owned)
Then the git host received these requests:   (fake log; optional)
```

### What a `Then` may observe (from most to least preferred)

1. **The command's own payload.** It is schema-validated and compared whole, as the plugin suite does today.
2. **A follow-up read the user would run:** `marketplace list` / `marketplace info` after an add or remove, `plugin list` after a remove cascade, and `new_session` skills after a cascade uninstall. This is the session.steps.ts principle ("look where the user looks"). Use it as a separate scenario, not as a second `When` in the same one.
3. **User-owned files:** `claude-plugins.json` in `<cwd>/.pi/` (project) or `<agentDir>/` (user), read through a world getter `configPath(scope)`. Compare the whole `marketplaces` map projected to rows (`name | source | autoupdate`, plus every other key present).
4. **The fake's request log:** for NFR-5 (list, info, remove, path sources reach the network zero times) and for retry and `.git`-suffix behavior.

**Never assert:** `state.json`, clone directories under `pi-claude-marketplace/sources/`, `plugin-clones/` keys, or lock files. These are internal (features.md: "files the user owns" only), and asserting them couples the suite to internals that unit tests already cover.

### Env flow (fixed at Pi start)

```
BeforeAll: HttpsGitHost.start(dir) -> {certPath, baseUrl}
  -> piEnvironment() = { NODE_EXTRA_CA_CERTS: certPath, GITHUB_BASE_URL: baseUrl, GIT_CONFIG_NOSYSTEM: "1" }
  -> startRpcPi(sandbox, extraEnv) -> childEnvironment(sandbox) ∪ extraEnv (explicit keys only)
```

`GIT_CONFIG_NOSYSTEM=1` matters because `platform/git-credential.ts` shells out to `git credential fill` for every non-provider host (127.0.0.1 included). HOME is already the sandbox, but `/etc/gitconfig` can name a system credential helper (libsecret, GCM) and reach the developer's keyring. Set the same on the host's own `git http-backend` and fixture `git` calls, plus `GIT_CONFIG_GLOBAL=/dev/null` and `HOME=<root>/git-host/home`, so a developer's `commit.gpgsign=true` or hooks never run.

## Scaling Considerations

| Scale | Adjustment |
|-------|------------|
| Today (about 15 plugin scenarios) | One Pi per worker, parallel 8. |
| +40-60 marketplace scenarios | 8 hosts, 8 certificates (one openssl call each, under 100 ms), 8 Pis. Each git request forks `git http-backend`; a clone is 2-3 requests. Expect about 50 ms per git scenario, which is fine. |
| CI `static`/`integration` timeouts | `test:cucumber` runs inside `npm run check` and its own `ci.yml` step (line 145). Watch that job's timeout once git scenarios land. |

### Bottlenecks

1. **Pi replacement after a failed scenario** (about 1 s): the existing cost. The host survives the replacement, so nothing new.
2. **Keep-alive sockets from Pi to the host:** `stop()` must call `server.closeAllConnections()` and kill in-flight CGI children, or `AfterAll` hangs until the step timeout.

## Anti-Patterns

### Anti-Pattern 1: A second module-level variable for the host

**What people do:** `let host: HttpsGitHost | undefined` in a new `support/https-git-host.ts`, with its own `BeforeAll`.
**Why it's wrong:** It breaks the single module-state exception, and `BeforeAll` order across modules decides whether Pi spawns before the certificate exists. Node then only warns, and every clone fails as a self-signed certificate.
**Do this instead:** Put it on `PiRun` and start it in the same `BeforeAll`, before `PiProcess.start`.

### Anti-Pattern 2: Overriding only the wire URL, or keeping `GITHUB_HOST`

**What people do:** Patch `networkCloneUrl` or `add.ts` to swap the host and leave `GITHUB_HOST = "github.com"`.
**Why it's wrong:** `onAuth` cancels on the host mismatch, so the 401 scenarios test a guard instead of auth. `originMatchesSource` stops recognizing leftovers. A missed literal (`update.ts:399`, `update-flow.ts:151`) keeps sending update fetches to the real github.com, which in a hermetic test is a network leak.
**Do this instead:** One read in `canonicalCloneUrl`, and replace the constant with a function, so the compiler lists every site.

### Anti-Pattern 3: Filtering payloads to find "the" result

**What people do:** `payloads.find((p) => p.kind === "cascade")`.
**Why it's wrong:** An unexpected extra payload (a stray `diagnostic`, a duplicate cascade) passes silently. That is the skill's top BLOCKER: a scenario a wrong implementation still passes.
**Do this instead:** `lastResult()` asserts exactly one payload. A multi-payload step compares the whole ordered list.

### Anti-Pattern 4: Asserting `state.json` or clone directories

**Why it's wrong:** Steps must name user-visible things, and these files change with internal refactors.
**Do this instead:** Use follow-up `list`/`info`, `claude-plugins.json`, and the request log.

### Anti-Pattern 5: Naming the production module `platform/github-*.ts`

**Why it's wrong:** BLOCK F's `platform/git` substring regex matches it and fails every network-free importer.
**Do this instead:** `shared/github-base-url.ts`.

## Integration Points

### External services (stand-ins)

| Service | Stand-in | Notes |
|---------|----------|-------|
| Any HTTPS git host (url sources) | `lib/https-git-host.ts` | CGI env: `GIT_PROJECT_ROOT`, `GIT_HTTP_EXPORT_ALL=1`, `PATH_INFO`, `QUERY_STRING`, `REQUEST_METHOD`, `CONTENT_TYPE`, `HTTP_CONTENT_ENCODING` (isomorphic-git may gzip upload-pack bodies). Parse the CGI `Status:` header. Arm per repo path; "drop" = `socket.destroy()` before headers. |
| GitHub (`owner/repo`, `https://github.com/...`) | the same host through the base-URL override | Layout `/<owner>/<repo>.git`. The Device Flow stays unreachable by design (no provider for the loopback host), so GitHub-specific auth (Device Flow prompt) is out of scope for this suite. Say so in the feature description. |
| Local directory / direct `marketplace.json` | `lib/path-marketplace.ts` | Move the root under the sandbox HOME so commands can type `~/marketplaces/<name>`. Before already empties HOME, so the per-scenario `onRelease(rm)` becomes optional (keep it for symmetry). |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `features/lib` -> `tests/e2e/_rpc.ts` | import `startRpcPi`, `killProcessGroup` | layout.md permits reusing a process harness. Widen the signature and do not copy it. The only consumer today is `features/lib/pi-process.ts`. |
| `features/lib` -> `extensions/.../shared/notification-wire.ts` | import `NOTIFICATION_PAYLOAD_SCHEMA` (value) | Same as today's `CASCADE_PAYLOAD_SCHEMA` import. The schema is the published contract world-and-stand-ins.md asks drivers to validate against. |
| `domain/clone-key.ts` -> `shared/github-base-url.ts` | import | Allowed by the `domain -> shared` zone. Not a BLOCK F import. |
| `orchestrators/auth-host.ts` -> `shared/github-base-url.ts` | import | auth-host is already a `NETWORK_SEAM`, which doesn't matter for this import. |
| Unit tests for the new module | `tests/shared/github-base-url.test.ts` | Required by the source-test pairing and the 100% direct coverage gate. Each case sets the env var and registers its restore with `t.after()` (the workflow-home precedent). `clone-key`, `auth-host`, `add`, `update`, and `update-flow` tests gain one override case each. |

## Suggested Build Order

| # | Phase | Depends on | Delivers |
|---|-------|-----------|----------|
| 1 | **Driver widening + path-source marketplace features** | none | `runCommandPayloads` + union validation, `results` on the world, the `marketplace.steps.ts` split, `config.steps.ts`, `~/marketplaces` relocation. Features: `add` (directory, manifest file, refused forms Outline, usage errors), `list`, `info` (single, fan-out, not-added), `remove` (incl. cascade onto an installed plugin), `update` single + bare multi-payload (path sources), `autoupdate`/`noautoupdate`. No network anywhere, so most scenarios land early. |
| 2 | **`GITHUB_BASE_URL` production seam (D-MF-01)** | none (can run parallel to 1) | `shared/github-base-url.ts`, `canonicalCloneUrl`, `gitHubHost()` replacing `GITHUB_HOST` at 3 sites plus the `update.ts` literal, unit tests, CHANGELOG/README note of the divergence. Settle the env var name first (Open Decision 1). |
| 3 | **HTTPS git host stand-in + url sources** | 1 | `lib/https-git-host.ts`, `lib/git-marketplace.ts`, `_rpc.ts` extra env, `PiRun.gitHost` + reset assertion, skill-rule amendment (Open Decision 2), `git-host.steps.ts`. Features: https URL add/update/remove/info, armed 401/404/5xx/drop failures, `.git`-suffix verbatim behavior, NFR-5 "no requests" checks for list/info/remove. Its first plan should be one walking-skeleton scenario through Pi `--offline` before the rest. |
| 4 | **GitHub sources through the override** | 2 + 3 | `owner/repo`, `https://github.com/owner/repo[.git][#ref]` add/update; info shows `owner`/`repo`; the config records the raw form; `ref` pinning. Pi env gains `GITHUB_BASE_URL` here (harmless if set in phase 3 already). |
| 5 | **Suite review gate** (may fold into 4) | 1-4 | `npx cucumber-js --dry-run --format usage` shows no UNUSED steps, `fallow dupes` on `path-marketplace`/`git-marketplace`, CI timing, and the cucumber skill review pass. |

**Ordering rationale:** Phase 1 carries the driver and world changes every later phase consumes, and it needs no new infrastructure. Phase 2 is a production change with its own unit-test gate, independent of `features/`, so it can be reviewed in isolation and parallelized. Phase 3 is the riskiest (CGI, TLS trust inside Pi `--offline`, rule amendment) and needs the widened driver. Phase 4 is thin once 2 and 3 exist.

**Research flags:**
- Phase 3 needs a walking-skeleton check that Pi's `--offline`/`PI_OFFLINE=1` does not block extension-initiated HTTPS. The spike ran isomorphic-git, not inside Pi.
- Phase 1 needs the bare-`update` payload order and any trailing `mcp-config-notices` payloads checked by running them.
- Phases 1 and 2 are standard patterns.

## Open Decisions for the User

1. **The env var name.** The Terraform GitHub provider and others already read `GITHUB_BASE_URL`, and there it points at an **API** URL (`https://ghe.example.com/api/v3/`). A Pi user with it exported for Terraform would have every GitHub marketplace clone silently redirected to a wrong URL. That breaks D-MF-01's "unset is byte-identical" promise in practice. Recommend `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, which matches the `PI_CLAUDE_MARKETPLACE_DEBUG` precedent. This means amending D-MF-01.
2. **Amend `.agents/skills/cucumber/rules/world-and-stand-ins.md`** to allow a stand-in whose address or trust root the slow process pins at start to live in the same run state (Pattern 1).
3. **A set but invalid override** (not `https:`, or has a path, query, or userinfo): throw a typed error at use (fail-clean, recommended) or treat it as unset (silent).
4. **Optional:** rename `PluginWorld` -> `ScenarioWorld` now that marketplace steps share it.

## Sources

- Code on this branch (HIGH): `features/**`, `tests/e2e/_rpc.ts:167-174,400-404`, `extensions/pi-claude-marketplace/domain/clone-key.ts:81-128`, `domain/source.ts:348-357,604-650,755-764`, `orchestrators/auth-host.ts:76-98,229-249`, `orchestrators/marketplace/add.ts:850-1030`, `orchestrators/marketplace/update.ts:386-420`, `orchestrators/plugin/update-flow.ts:145-158`, `platform/git-auth-callbacks.ts:84-120,170-190`, `platform/workflow-home.ts`, `shared/debug-log.ts:23`, `shared/notification-wire.ts:291-560,800-833`, `persistence/config-write-back.ts`, `domain/manifest-cache.ts` (same-size mtime residual risk), `.fallowrc.json` boundaries, `eslint.config.js:44-106,364-381`, `cucumber.json`, `.agents/skills/cucumber/rules/*.md`.
- [Node.js CLI docs, `NODE_EXTRA_CA_CERTS`](https://nodejs.org/api/cli.html#node_extra_ca_certsfile): read only at launch; a missing file only warns. Quoted verbatim; the seam rates the provider tier LOW, but the content is the official docs.
- Web search for `GITHUB_BASE_URL` usage (MEDIUM): [terraform-aws-atlantis#244](https://github.com/terraform-aws-modules/terraform-aws-atlantis/issues/244), [git_store GitHub config](https://git-store.hexdocs.pm/1.0.0/git_store/github_config.html), [Codespaces default env vars](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace).
- `.planning/BACKLOG.md` GHCAN-01/02: an earlier manual `git http-backend` behind HTTPS stand-in drove `marketplace add`/`update` through Pi (precedent for the CGI approach).

---
*Architecture research for: marketplace-features (cucumber behavioral tests for `/claude:plugin marketplace`)*
*Researched: 2026-10-15*
