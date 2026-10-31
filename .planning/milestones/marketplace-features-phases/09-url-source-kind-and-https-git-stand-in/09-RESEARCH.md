# Phase 9: URL Source Kind and HTTPS Git Stand-In - Research

**Researched:** 2026-10-20
**Domain:** Cucumber test infrastructure: a loopback HTTPS `git http-backend` stand-in, a bare-repository fixture, a hermetic git environment, and the url source kind of `features/lib/published-marketplace.ts`
**Confidence:** HIGH. Most claims below come from experiments run this session against the real Pi RPC child and the real extension, not from reading alone.

## Summary

The phase is less risky than the research flag assumed. A scratch copy of the suite with a quick url stand-in ran every `@url` row the verb phases wrote. **30 of 32 `@url` scenarios passed on the first run**, three times in random order. That includes the four LAYER-07 rows and the update row whose cause chain reads "clone advanced but manifest could not be persisted". The two failures have clear causes (see "Predicted `@url` failures"):

- The info row types `#stable`, and no `stable` ref exists in the bare repository.
- The autoupdate row needs an unreadable skill file, and git cannot store or index a mode-000 file.

The walking skeleton's open question is answered. Pi's `--offline` / `PI_OFFLINE=1` RPC child lets the extension's isomorphic-git HTTPS reach the stand-in, with `NODE_EXTRA_CA_CERTS` trusted and TLS verification on. The request log showed `GET /acme/tools.git/info/refs?service=git-upload-pack 200` and `POST /acme/tools.git/git-upload-pack 200`. Pi installs an undici global dispatcher, but it only affects `fetch`. isomorphic-git's node client uses `node:https`, which the dispatcher does not touch.

Every armed failure was measured end to end, so the planner can write the expected payloads now:

- **Add:** 404 is `source missing`. 500, 502, and 503 are `network error`, with the cause chain `["<status> on https://{git host}/acme/<repo>.git", "HTTP Error: <status> <phrase>"]`. A dropped socket is `network unreachable`. A 401 is `authentication required` without a credential, and `added` with a stored credential.
- **Update:** the same 5xx frames apply, and 404 is also `network error`. A dropped socket gives `network unreachable`, with the cause `socket hang up`. That text is identical on Node 22 and Node 26.

The SC6 red proof works with a three-line local edit, because the old install files no longer load. All three LAYER-07 remove rows fail on a `Then the result has these fields:` assertion and pass once the edit is reverted.

**Primary recommendation:** build the stand-in as part of the run's one module-level state (`PiRun`). Implement each url arm as "run the existing dir writer on a work tree, then commit and push into the bare repo". Open the request-log window with a `BeforeStep` hook keyed on Action steps. Triage `@url` rows with an alternate cucumber config: `cucumber-js --tags @url` runs **0** scenarios, because the CLI `--tags` is ANDed with the profile's `not @url and not @github`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTPS git server (CGI wrapper, request log, arming) | Test library `features/lib/` | — | It is a stand-in for an external service, and it registers nothing (layout.md) |
| Stand-in lifetime: start, reset, stop | Test support `features/support/pi-process.ts` | `features/lib/` (reset implementation) | Pi fixes the port and the CA at start, so the stand-in joins the run's only module state (HOST-02) |
| Bare-repo marketplace fixture (work tree, commit, push) | Test library `features/lib/` | — | It is a fixture, and the source-kind dispatch in `published-marketplace.ts` calls it |
| Pi child environment allowlist | Test harness `tests/e2e/_rpc.ts` | `features/lib/pi-process.ts` | `_rpc.ts` is the only place that spawns Pi. A typed extra-env input keeps the allowlist closed |
| Request-log window per `When` | Test support (a `BeforeStep` hook) | World field | One central hook cannot be forgotten by a future `When` step |
| Log assertion steps | Step module (url-owned) | — | D-03: log steps appear only in url-owned features |
| `{git host}` token | `features/lib/run-tokens.ts` + world `tokens` | — | Same exact-substring mechanism as `{home}` (Phase 1 D-03) |
| Failure classification (401/404/5xx/errno) | Production `shared/git-failure-classifiers.ts` (unchanged) | `orchestrators/marketplace/{add,update}.ts` | Scenarios pin the existing classification. No production change is expected |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Request log (HOST-04)

- **D-01 (user):** Each request-log row shows method, path (with query), and
  the response status, for example
  `| GET | /acme/tools.git/info/refs?service=git-upload-pack | 200 |`. The
  path pins SC-01's exact typed URL (no `.git` appended), and the status shows
  which arm answered.
- **D-02 (user):** A log step compares only the requests of the last command.
  Each `When` starts a fresh window, so "add, then list" asserts that `list`
  made no request without restating the clone. The per-scenario reset still
  empties the whole log (HOST-02).
- **D-03 (user):** Log steps (a full table, or a "made no request" step)
  appear only in the url-owned feature files of this phase. The verb phases'
  `@url` rows share Outlines with dir and file rows and stay untouched.
- **D-04 (user):** No uncompared-log enforcement. Unlike `markRowsCompared`,
  a scenario does not fail when a command made requests that no log step
  compared; only explicit log steps assert.

#### Failure arming (HOST-03)

- **D-05 (user):** A scenario arms one repository, not the whole host. Other
  repositories keep serving, so a bare update can show one failure beside a
  success.
- **D-06 (user):** The 401 arm accepts one credential: it answers 401 unless
  the request carries the user and password the scenario names. One arm
  proves both the no-credential failure and the stored-credential success.
- **D-07 (user):** The 5xx rows are an Outline over 500, 502, and 503, so a
  classifier keyed on one status fails. The cause line names each status and
  the URL.
- **D-08 (user):** A dropped connection drops on the first request: the
  socket is destroyed on the `info/refs` GET, which Pi's errno ladder
  (`ECONNRESET`) classifies as `network unreachable`.

#### Credential and git isolation (DRV-03, ADD-11 url half)

- **D-09 (user):** The credential `Given` writes the sandbox files directly:
  a `.gitconfig` naming the `store` helper and a `.git-credentials` line for
  the stand-in origin. No git process runs in the step.
- **D-10 (user):** Pi's `GIT_CONFIG_GLOBAL` points at the sandbox
  `HOME/.gitconfig`, with `GIT_CONFIG_NOSYSTEM=1` and no inherited `GIT_*`.
  `Before()` empties HOME, so no helper survives a scenario; the file is
  absent unless a credential `Given` writes it.
- **D-11 (user):** Isolation is proven by a paired unit test that the env
  builders emit no inherited `GIT_*` and set `GIT_CONFIG_NOSYSTEM`, plus a
  by-hand control run once (a planted system or global credential helper
  outside the sandbox changes no result) recorded in the plan SUMMARY. No
  committed negative control (CONVENTIONS).
- **D-12 (user):** The stand-in's `git http-backend` and the fixture `git`
  runs use their own scratch HOME with `GIT_CONFIG_GLOBAL=/dev/null`, separate
  from Pi's sandbox HOME, so a scenario's credential config cannot change how
  the server behaves.

#### Failing `@url` rows

- **D-13 (user):** A verb-phase `@url` row that fails against the stand-in is
  triaged. A product bug is fixed test-first in this phase (the failing row is
  the RED evidence, as in Phases 6 to 8), with paired unit tests and a
  CHANGELOG line. A wrong row is corrected. A fix that changes user-visible
  behavior beyond the requirement wording, or touches upstream parity, stops
  for the user's decision.
- **D-14 (user):** Until the last plan, plans run `cucumber-js --tags @url`
  by hand to triage. `cucumber.json` keeps the exclusion until the last plan,
  so every commit stays green.
- **D-15 (user):** The LAYER-07 remove Outlines' red-then-green proof (SC6)
  plants the old install files from the parent of the commit Phase 3.2's plan
  07 SUMMARY names (or an equivalent local edit), runs the `@url` rows, saves
  the result as a `*-RED.json` in the phase directory as Phase 7 did,
  restores, and runs green. The plant is never committed.

#### Pinned as they are (carried forward, not re-asked)

- Tokens use braces; the stand-in origin is `{git host}` (Phase 1 D-03), as
  the existing `@url` rows write `https://{git host}/acme/tools.git`.
- `127.0.0.1` everywhere, HTTPS only, `NODE_TLS_REJECT_UNAUTHORIZED` never
  set. The certificate is made per worker at run time and never committed.
- Pi's env stays an allowlist built from scratch; `startRpcPi` gains a typed
  extra-env input and never spreads `process.env`.
- `Then` steps observe payloads, follow-up `list`/`info`, user-owned config
  files, and the request log; never `state.json` or clone directories.
- The missing credential hint on `add` is pinned as it is (milestone
  invariant).

### Claude's Discretion

- Exact step wording, feature-file names for the url-only behaviors, the
  module split under `features/lib/` (named for the kind, per layout.md), and
  the plan split.
- The CGI details the research flag names: `CONTENT_LENGTH`, chunked bodies,
  `Git-Protocol` → `GIT_PROTOCOL`, and a unit-tested CGI header parser.
- Which refused source forms form the ADD-08 Outline rows, as long as every
  form REQUIREMENTS.md lists is covered and each row asserts no request.

### Deferred Ideas (OUT OF SCOPE)

- GitHub rows, UPD-12, SRC-02, SRC-03, and the suite close stay in Phase 10.

#### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` §3: ports the skill to `acolomba/blueprint-typescript`, another repository.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOST-01 | Loopback HTTPS git server (node:https CGI wrapper around `git http-backend`, run-time openssl cert via `NODE_EXTRA_CA_CERTS`) serves bare repos isomorphic-git clones and fetches | Walking-skeleton experiment (§Experiments E1); CGI env and parser (§Pattern 2–3) |
| HOST-02 | Stand-in lives for the worker's run, reset before every scenario (repos, arming, log, CGI children), reset asserted empty; skill rule amended | §Pattern 1 lifetime; rule-amendment targets (§Rule amendments) |
| HOST-03 | Arm a repository to answer 401, 404, 5xx, or drop | §Pattern 4; measured payloads (§Measured payloads) |
| HOST-04 | Record every request; scenarios assert the exact log, including empty | §Pattern 5 log + window; connection counting for "no request" (Pitfall 3) |
| DRV-03 | Pi, stand-in, fixture git run hermetic (`GIT_CONFIG_NOSYSTEM=1`, sandbox global config, no inherited `GIT_*`) | §Pattern 6; credential experiments E5 |
| ADD-08 | Refused forms fail `unsupported source`, stand-in gets no request | Measured all eight forms (E6); row split untagged vs `@github` (§ADD-08 rows) |
| ADD-09 | Url clone answered 404 → `source missing` | Measured (E3) |
| ADD-10 | 5xx → `network error` with status+URL cause; drop → `network unreachable` | Measured 500/502/503 and drop (E3) |
| ADD-12 | Removed git marketplace re-added from same source | Measured remove → re-add clones again (E6) |
| RM-09 | Remove of git marketplace makes no request | Measured zero log rows (E6) |
| LS-05 | List of git marketplaces makes no request | Measured zero log rows (E6) |
| INFO-07 | Info on git marketplaces makes no request | Measured zero log rows (E6) |
| UPD-11 | Update vs 5xx/404 → `network error` with status+URL cause; drop → `network unreachable` | Measured (E4) |
| SRC-01 | Url cloned at exactly the URL typed; `.git` not appended | Measured: typing `/acme/bare` logs `/acme/bare/info/refs…`; http-backend serves `acme/bare.git` (E1) |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; branch `features/cucumber-behavioral-tests`; never rebase; commits follow `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- GSD gates run `npm run check` on the combined tree (post-merge wave gate, phase gate). `check:commit` does **not** run cucumber, so a features-only commit is green at commit time and can still fail `npm run check`. [VERIFIED: package.json:86-87 `"check": "... && npm run --silent test:cucumber && ..."`, `"check:commit": "npm run --silent check:static && npm run --silent test:unpaired && npm run --silent test:coverage:direct:commit"`]
- Editing `tests/e2e/_rpc.ts` (a non-`.test.ts` file under `tests/`) makes `check:commit` run **all** pairs' direct coverage. [CITED: .agents/skills/local-verification/rules/commands.md]
- Every plan SUMMARY includes `## Threat Flags` (AGENTS.md).
- Upstream parity: this phase is test infrastructure. Any product fix found under D-13 that changes user-visible behavior stops for the user.
- Containment/NFR-5: scenarios never reach the public network. Refused GitHub-shaped forms must not run before the override exists (see ADD-08 rows).
- Comments cite durable IDs (HOST-0x, DRV-03, D-0x), never phase/plan numbers (CONVENTIONS).
- Fallow health (cognitive 15, cyclomatic 20) and dupes cover `features/**`. ESLint cognitive complexity 15 too. Keep the CGI parser and the request handler as small functions.
- Subagent tests must use a hermetic home (memory: a past fixer clobbered `~/.pi/agent/state.json`).

## Standard Stack

### Core

No new npm package. All four tools are already present. [VERIFIED: local probes this session]

| Tool | Version (local / CI) | Purpose | Why Standard |
|------|---------|---------|--------------|
| `git` CLI (`git http-backend`) | 2.55.0 local (Fedora, exec-path `/usr/libexec/git-core`) / 2.55.0 on `ubuntu-latest` [CITED: milestone research STACK.md, runner-images readme] | Smart-HTTP server behind the CGI wrapper. It also builds the fixture repositories | It is upstream's own server. `git http-backend` resolves through git's exec-path, so no path lookup is needed (verified locally) |
| `openssl` CLI | 4.0.3 local / 3.0.13 CI [CITED: STACK.md] | One self-signed cert per worker at run time | The command below ran this session in ~20 ms |
| `node:https`, `node:child_process` | Node 26.11.1 local; also probed on Node 22.22.2 (`/usr/bin/node`) | The CGI wrapper | stdlib. The `no-network-modules` rule-pack bans cover `extensions/**` only |
| isomorphic-git (already pinned) | 1.42.3 [VERIFIED: node_modules/isomorphic-git/package.json] | The client inside Pi | Proven against the stand-in this session |

**Certificate command (verified on OpenSSL 4.0.3 this session):**

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -keyout key.pem -out cert.pem -days 1 \
  -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1
```

`-nodes`, not `-noenc` (LibreSSL and OpenSSL 1.1 lack `-noenc`). [CITED: STACK.md] OpenSSL 3.0.13 on CI was not probed this session. [ASSUMED from STACK.md: every flag exists in 3.0.x]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git http-backend` behind `node:https` | git-http-mock-server, mockttp, node-git-server | Decided in milestone research. Not re-litigated |
| `openssl` CLI | `selfsigned` (about 20 transitive deps) | Rejected in milestone research |
| Buffering the whole CGI response | Streaming the CGI stdout to `res` | Buffering is simpler, makes the parser a pure function on a `Buffer`, and the packs are tiny. Streaming adds a chunk-boundary header split for no gain |

**Installation:** none.

## Package Legitimacy Audit

This phase installs no external package. The gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Experiments Run This Session (evidence)

All experiments ran under the session scratchpad (`/tmp/claude-1000/.../scratchpad/`), with a hermetic HOME, `PI_CODING_AGENT_DIR`, and a scratch git HOME. Nothing touched the repo or the real `~/.pi`, `~/.gitconfig`, or `~/.git-credentials`.

- **E1 Walking skeleton (real Pi RPC child + extension):** Pi was spawned with env `{HOME, PI_CODING_AGENT_DIR, PI_OFFLINE=1, PATH, NODE_EXTRA_CA_CERTS, GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=<sandbox>/.gitconfig}` and `--mode rpc --offline --no-session --extension <ext>`. [VERIFIED: scratch experiment output]
  ```
  ### /claude:plugin marketplace add https://{git host}/acme/tools.git --scope project  (317 ms)
  {"kind":"cascade","severity":"info","needsReload":false,"marketplaces":[{"name":"tools","scope":"project","status":"added","plugins":[]}]}
    LOG GET /acme/tools.git/info/refs?service=git-upload-pack 200 te=undefined cl=undefined gp=undefined
    LOG POST /acme/tools.git/git-upload-pack 200 te=undefined cl=146 gp=undefined
  ### /claude:plugin marketplace add https://{git host}/acme/bare --scope project  (108 ms)
  {... "marketplaces":[{"name":"bare","scope":"project","status":"added","plugins":[]}]}
    LOG GET /acme/bare/info/refs?service=git-upload-pack 200
    LOG POST /acme/bare/git-upload-pack 200
  ### /claude:plugin marketplace info bare
  {"kind":"marketplace-info",...,"source":{"sourceKind":"url","url":"https://{git host}/acme/bare"}}
  ```
  So the extension's HTTPS passes the `--offline` child. isomorphic-git sends `Content-Length` on the POST, never chunked. A clone sends no `Git-Protocol` header (protocol v1). `git http-backend` serves the suffix-less path `/acme/bare` from `acme/bare.git`: its repository lookup tries `<path>.git`. SRC-01 is therefore proven by the **log path**, not by a 404.
- **E2 PI_OFFLINE scope:** `PI_OFFLINE` is read in `dist/main.js:452`, `core/model-runtime.js:92`, `core/package-manager.js:39`, `utils/version-check.js:37`, `utils/tools-manager.js:13`, `modes/interactive/*`, and `bug-report.js:22`. None of them is a transport gate. `core/http-dispatcher.js` installs `undici.setGlobalDispatcher(new undici.EnvHttpProxyAgent(...))` plus `undici.install()`. That replaces global `fetch` only. isomorphic-git uses `isomorphic-git/http/node` (`platform/git.ts:5`), which runs on `node:https` and is unaffected. Pi sets `HTTP(S)_PROXY` only from a settings `httpProxy` value, and the Pi env allowlist carries no proxy variable. [VERIFIED: grep of node_modules/@earendil-works/pi-coding-agent/dist + E1 success]
- **E3 Add arming (real Pi):** see §Measured payloads.
- **E4 Update arming (real Pi):** see §Measured payloads.
- **E5 Credential store + isolation (`git credential fill` with the extension's env shape):** a `.git-credentials` line `https://alice:s3cret@127.0.0.1:4443` matches `host=127.0.0.1:4443` and returns alice/s3cret. A different port fails with `fatal: could not read Username for 'https://127.0.0.1:5555': terminal prompts disabled` (exit 128). A hostile `GIT_CONFIG_SYSTEM` helper is **ignored** under `GIT_CONFIG_NOSYSTEM=1` (no marker file). Without `NOSYSTEM`, the same helper runs (marker written, `username=evil` returned). The control can therefore detect a leak. [VERIFIED: scratch experiment output]
- **E6 Refused forms, no-request verbs, re-add (real Pi):** all eight forms → `unsupported source`, zero log rows. `marketplace list`, `info`, and `remove` of a url marketplace → zero log rows. A re-add after remove → `added`, with a fresh `GET`+`POST`. [VERIFIED]
- **E7 Real `git` client through the same wrapper:** protocol v2 (`Git-Protocol: version=2` → `GIT_PROTOCOL`) clone works. A chunked request body (`-c http.postBuffer=1`, `te=chunked cl=undefined`) works, because the wrapper buffers the body and sets `CONTENT_LENGTH`. [VERIFIED]
- **E8 Full scratch suite with a quick url stand-in:** default profile 313 scenarios passed in 9.8 s wall time, the same as without the stand-in. `@url` profile: 32 scenarios, 30 passed, 2 failed, the same in 3 random-order runs. [VERIFIED]
- **E9 SC6 plant:** the three files planted from `f78907bf` **no longer load**: `The requested module '../../shared/errors.ts' does not provide an export named 'MarketplaceDeclaredLocallyError'`. The equivalent local edit (§SC6) turns the three remove rows red at `Then the result has these fields:`. The cross-scope install row and the first remove Outline stay green. Restored, all 6 pass. [VERIFIED]
- **E10 Error text across Node versions:** a dropped HTTPS socket gives `ECONNRESET "socket hang up"` on both v22.22.2 and v26.11.1. `http.STATUS_CODES` reads `Internal Server Error | Bad Gateway | Service Unavailable | Not Found` on both. Node 24 was not available locally. [VERIFIED for 22 and 26; Node 24 ASSUMED to match, since it lies between two identical versions]
- **E11 `BeforeStep` exposes the step kind:** `pickleStep.type` is `Context`/`Action`/`Outcome` at runtime (cucumber-js 13.3.0). [VERIFIED]
- **E12 Plain HTTP pointed at the HTTPS stand-in:** server events are `connection` and `tlsClientError:ERR_SSL_HTTP_REQUEST`, with **no `request` event**. The client sees `ECONNRESET`. [VERIFIED]

## Measured payloads

`origin` is omitted, `{git host}` = `127.0.0.1:<port>`. All of these were measured with real Pi and the real extension (E3/E4). [VERIFIED: scratch experiment output]

**`marketplace add` (url source, `--scope project`):**

| Arm | Payload (marketplaces block) | Log rows |
|-----|-------------------------------|----------|
| 404 (armed, or repo absent) | `severity:error, summary:"A marketplace operation has failed."`, row `{name:"https://{git host}/acme/t404.git", scope:project, status:failed, reasons:["source missing"], plugins:[]}` | `GET …/info/refs?service=git-upload-pack 404` |
| 500 / 502 / 503 | `severity:error, summary:"Some operations have failed."`, block `{name:<url>, status:failed}` with one child `{status:failed, name:<url>, id:"<url>@<url>", reasons:["network error"], scope:project, cause:{causeChain:["500 on https://{git host}/acme/t500.git","HTTP Error: 500 Internal Server Error"], truncated:false}, leaks:[], rollbackPartial:[]}`. The 502 phrase is `Bad Gateway`, the 503 phrase `Service Unavailable` | `GET …/info/refs… <status>` |
| drop (socket.destroy on first request) | `summary:"A marketplace operation has failed."`, bare row `reasons:["network unreachable"]`, no cause | `GET …/info/refs… dropped` |
| 401, no credential | bare row `reasons:["authentication required"]`, no cause (C-12: add attaches no credential hint; pinned) | `GET … 401` |
| 401, stored credential (D-09 files) | `severity:info`, row `{name:"priv", status:added}` | `GET … 401`, `GET … 200`, `POST …/git-upload-pack 200` |

**`marketplace update <name> --scope project` (after a successful add, then republish):**

| Arm | Child row | Log rows |
|-----|-----------|----------|
| 500/502/503 | `id:"u500@u500"`, `reasons:["network error"]`, `causeChain:["500 on https://{git host}/acme/u500.git","HTTP Error: 500 Internal Server Error"]`, summary `Some operations have failed.` | `GET … 500` |
| 404 | `reasons:["network error"]`, `causeChain:["404 on https://{git host}/acme/u404.git","HTTP Error: 404 Not Found"]` (C-13 is resolved in code: update 404 is `network error`) | `GET … 404` |
| drop | `reasons:["network unreachable"]`, `causeChain:["Failed to update marketplace \"udrop\".","socket hang up"]` | `GET … dropped` |
| 401, no credential (Phase 10 SC3 territory, measured for reference) | `reasons:["authentication required"]`, `causeChain:["Failed to update marketplace \"uauth\".","The operation was canceled.","no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve"]` | `GET … 401` |
| none (republished) | `status:updated`, no plugin rows | `GET … 200`, `POST … 200` |

Node-version drift: none of these cause lines carries an fs errno message, so the Node 26 path suffix does not apply. `socket hang up` and the HTTP reason phrases are identical on Node 22 and 26 (E10). The phrases come from the **stand-in's** Node (`res.statusCode` with no explicit `statusMessage`), so they match whatever Node runs the worker.

Classifier source for these results [VERIFIED: extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts:21-30]:

```ts
const SOURCE_MISSING_HTTP_STATUSES = new Set([404, 410]);

const NETWORK_ERRNO_CODES = new Set([
  "ENETUNREACH",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);
```

## Architecture Patterns

### System Architecture Diagram

```
BeforeAll (support/pi-process.ts, once per worker)
  mkdtemp run root ──► openssl cert ──► https-git-host.listen(127.0.0.1:0)
        │                                        │ port, certPath
        ▼                                        ▼
  Pi env = allowlist + {NODE_EXTRA_CA_CERTS, GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=<sandbox home>/.gitconfig}
        │
        ▼
  PiProcess.start(sandbox, env) ── stored on PiRun {root, sandbox, marketplacesRoot, gitHost, piEnvironment, pi}

Before (every scenario)
  pi busy? ──yes──► stop + PiProcess.start(sandbox, same env)
  gitHost.reset(): kill+await CGI children, clear arms, empty log + connection count, rm repositories/ and work/, closeIdleConnections
  empty sandbox dirs ──► new_session ──► `list` ──► assert {skills:[], marketplaces:[], gitHost.snapshot(): empty}

Scenario
  Given "published as a url source" ──► git-marketplace fixture: dir writer on work/<dir> ──► git add/commit ──► clone --bare / push ──► repositories/acme/<dir>.git
  Given arm/credential ──► gitHost.arm(repo, arm) | write <sandbox home>/.gitconfig + .git-credentials
  BeforeStep(Action) ──► world.requestWindow = gitHost.mark()
  When "the user runs ..." ──► expandTokens({home},{git host}) ──► Pi RPC prompt
        │
        ▼
   Pi extension ── isomorphic-git (node:https, trusts NODE_EXTRA_CA_CERTS) ──► https-git-host
        │                                                        │
        │                              arm? ─ drop ► socket.destroy() (log "dropped")
        │                                   ─ status ► res.statusCode=N (log N)
        │                                   ─ 401 ► WWW-Authenticate unless Basic matches
        │                              else ► buffer body ► spawn `git http-backend` (CGI env from scratch)
        │                                        ► parse header block ► status + headers + body ► res (log status)
        ▼
  claude-plugin payloads ──► world.results
  Then payload/table steps ──► projectTokens ;  Then log steps ──► gitHost.requestsSince(world.requestWindow)

AfterAll: pi.stop() ► gitHost.close() (closeAllConnections, kill children) ► rm run root
```

### Recommended Project Structure (discretion; names are recommendations)

```
features/
  lib/
    https-git-host.ts        # the stand-in: cert, server, arming, request log, reset (or split into lib/https-git-host/ if it grows)
    cgi-response.ts          # OR lib/https-git-host/cgi-response.ts: pure parser of a CGI response Buffer
    git-marketplace.ts       # bare-repo fixture: fixture-git env, work tree, commit, push; shared by url (now) and github (Phase 10)
    published-marketplace.ts # url arms call git-marketplace; signatures gain the git host / repository handle
    run-tokens.ts            # + {git host}
  support/
    pi-process.ts            # PiRun gains gitHost + piEnvironment; BeforeAll/Before/AfterAll extended
    https-git-host.ts        # BeforeStep(Action) opens the request window; no module state
  step_definitions/
    marketplace/url-source.steps.ts   # or git-host.steps.ts: arm, credential, log steps (step text names its vertical)
  marketplace/
    url-source.feature        # "Marketplace url source": skeleton add + log, SRC-01, 404, 5xx Outline, drop, 401 x2, refused forms
    url-source-update.feature # "Marketplace url source update": UPD-11 (precedent: file-source-update.feature)
    git-source.feature        # "Marketplace git source": @url/@github Outlines for re-add and the empty-log list/info/remove
tests/
  architecture/https-git-host.test.ts (or cgi-response.test.ts, git-marketplace.test.ts)  # unit tests; precedent tests/architecture/marketplace-info-fields.test.ts
  e2e/_rpc.ts                 # typed extra env on startRpcPi
```

Gate facts the layout must satisfy [VERIFIED: scripts/check-features.mjs:238-251, 257-274]: a `features/lib` file sits at depth ≤ 3 (`lib/<name>.ts` or `lib/<dir>/<name>.ts`), no catch-all name (`common, shared, utils, helpers, support, misc, hooks, parameter-types`), and no module beside its own directory (`lib/https-git-host.ts` **and** `lib/https-git-host/` together is a finding). Feature title must equal `<function> <capability>` of the file name (`Feature: Marketplace url source` ↔ `features/marketplace/url-source.feature`).

### Pattern 1: Stand-in lifetime on `PiRun` (HOST-02)

**What:** Start the host and its cert in the **same** `BeforeAll` that starts Pi, before Pi. Store it and the Pi env on `PiRun`. In `Before()`, replace a busy Pi with the **same** env, reset the host, then empty the sandbox, start a session, `list`, and assert everything is empty, including the host. Stop it in `AfterAll` after Pi.

**Why:** Pi reads `NODE_EXTRA_CA_CERTS` once at start, and the port is baked into the cert trust and the tokens. Two support files' `BeforeAll` order is not guaranteed. The cucumber rule allows exactly one module-level state.

**Today's code to extend** [VERIFIED: features/support/pi-process.ts:27-32, 47-96]: `PiRun { root; sandbox; marketplacesRoot; pi }`, `BeforeAll` at line 47, `Before` at 67 (replaces with `PiProcess.start(run.sandbox)`), `AfterAll` at 92.

**Reset contract (assert after the session and `list`, so they too are shown to make no request):**

```ts
// Source: scratch suite E8 (pattern), adapted
assert.deepStrictEqual(
  { skills, marketplaces: listed.marketplaces, gitHost: run.gitHost.snapshot() },
  { skills: [], marketplaces: [], gitHost: { repositories: [], arms: [], requests: [], connections: 0, children: 0 } },
);
```

Import time: the dry-run feature gate (`check:features`) loads support modules but runs no hooks. The stand-in must start only inside `BeforeAll`, never at module load. [ASSUMED: inferred from the fact that `check:features` passes today without starting Pi]

### Pattern 2: CGI environment, built from scratch (D-12)

```ts
// Source: verified in E1/E7 (standin.mjs) — every key listed was exercised
function fixtureGitEnvironment(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,                        // scratch HOME for server + fixtures, never Pi's sandbox HOME
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features", GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features", GIT_COMMITTER_EMAIL: "features@example.test",
  };
}

function cgiEnvironment(req: IncomingMessage, url: URL, body: Buffer, projectRoot: string, home: string): NodeJS.ProcessEnv {
  return {
    ...fixtureGitEnvironment(home),
    GIT_PROJECT_ROOT: projectRoot,
    GIT_HTTP_EXPORT_ALL: "1",                       // without it http-backend refuses unexported repos
    PATH_INFO: decodeURIComponent(url.pathname),
    QUERY_STRING: url.search.slice(1),              // service=git-upload-pack; without it: dumb protocol
    REQUEST_METHOD: req.method ?? "GET",
    CONTENT_TYPE: req.headers["content-type"] ?? "",
    CONTENT_LENGTH: String(body.length),            // always set: the body is buffered, so chunked requests work (E7)
    ...(req.headers["git-protocol"] === undefined ? {} : { GIT_PROTOCOL: String(req.headers["git-protocol"]) }),
    ...(req.headers["content-encoding"] === undefined ? {} : { HTTP_CONTENT_ENCODING: String(req.headers["content-encoding"]) }),
  };
}
```

- Fixture commands run as `git -c init.defaultBranch=main -c commit.gpgsign=false ...` in the same env (verified).
- `REMOTE_USER`/auth: not needed. It matters only for `receive-pack`, and the host serves upload-pack only. Authentication is the wrapper's arm, not http-backend's.
- gzip `Content-Encoding`: isomorphic-git never sends it (no `content-encoding`/`gzip` in `node_modules/isomorphic-git/index.cjs`, and its node client collects the body into a Buffer at `http/node/index.cjs:206`). Passing `HTTP_CONTENT_ENCODING` through costs one line. It was not exercised. [VERIFIED absence by grep; pass-through behavior CITED: git-http-backend docs via STACK.md]
- Fixed author/committer **dates** are optional. No commit sha is asserted anywhere. Use `commit --allow-empty` so a republish of identical bytes still makes a commit.

### Pattern 3: CGI response parser (unit-tested, pure)

```ts
// Source: verified behavior in E1/E7; http-backend prints "Status: 404 Not Found" only on errors
export interface CgiResponse { readonly status: number; readonly headers: ReadonlyArray<readonly [string, string]>; readonly body: Buffer }

export function parseCgiResponse(output: Buffer): CgiResponse {
  const crlf = output.indexOf("\r\n\r\n");
  const lf = output.indexOf("\n\n");
  const [end, gap] = crlf !== -1 && (lf === -1 || crlf < lf) ? [crlf, 4] : [lf, 2];
  if (end === -1) { throw new Error("the CGI response has no header block"); }
  // header lines -> Status (default 200) + other headers; body is binary, never decoded
  ...
}
```

Unit cases (each would fail for a plausible wrong parser):

- A CRLF block with no `Status` gives 200.
- `Status: 404 Not Found` gives 404 and is not forwarded as a header.
- An LF-only block parses.
- A body that itself contains `\r\n\r\n` and non-UTF-8 bytes is returned byte-identical (split at the **first** boundary only).
- Output with no terminator throws.
- A header value containing `:` (for example `Content-Type: application/x-git-upload-pack-advertisement`) keeps everything after the first colon.

**Where the test lives:** `test:corresponding` pairs only `extensions/pi-claude-marketplace/**` sources [VERIFIED: scripts/check-corresponding-tests.mjs:8-10 `const productionRoot = "extensions/pi-claude-marketplace";` `const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);`]. So a `features/lib` module has no required pair and no direct-coverage gate. The precedent for a unit test of a `features/lib` module is `tests/architecture/marketplace-info-fields.test.ts`, which imports `../../features/lib/marketplace-info-fields.ts`. Tests under `tests/architecture/` run in `npm test`, `test:unpaired`, and therefore `check:commit`. D-11's "paired unit test" maps here: the test is "paired" in name only, not by the gate.

### Pattern 4: Arming per repository (HOST-03, D-05..D-08)

```ts
// Source: E3/E4 (standin.mjs). Arm lookup keyed by repository, matching BOTH /acme/tools and /acme/tools.git prefixes
type Arm =
  | { readonly kind: "status"; readonly status: 404 | 500 | 502 | 503 }
  | { readonly kind: "drop" }
  | { readonly kind: "credential"; readonly user: string; readonly password: string };

// in the request handler, before buffering the body:
if (arm?.kind === "drop") { entry.status = "dropped"; req.socket.destroy(); return; }
if (arm?.kind === "status") { entry.status = arm.status; res.statusCode = arm.status; res.end(); return; }
if (arm?.kind === "credential" && req.headers.authorization !== basic(arm.user, arm.password)) {
  entry.status = 401; res.writeHead(401, { "WWW-Authenticate": 'Basic realm="git host"' }); res.end(); return;
}
```

- **Drop:** an immediate `req.socket.destroy()` gives `ECONNRESET` → `network unreachable` (E3, E4). Never offer a "hang" arm. isomorphic-git has no client timeout, so a hang costs the 30 s step timeout and a busy Pi.
- **Natural 404:** a repository that was never published also returns 404 from http-backend (`Not a git repository` on stderr). For ADD-09, use the **armed** 404 (HOST-03, symmetric with 5xx). The natural 404 behaves identically for `add`.
- Arms are cleared by the reset. An arm set by a failed scenario cannot leak.

### Pattern 5: Request log and per-`When` window (HOST-04, D-01, D-02, D-04)

- Log entry: `{ method, path: req.url /* path+query, as sent */, status: number | "dropped" }`. Record the entry on arrival and fill in `status` when the response is decided. **Recommendation:** a dropped request records the literal `dropped` in the status column (D-01 says "status shows which arm answered"; no HTTP status exists for a drop).
- Also count TCP connections (`server.on("connection")`). See Pitfall 3 for why "made no request" must check **both** requests and connections.
- Window: register `BeforeStep(function ({ pickleStep }) { if (pickleStep.type === "Action") this.requestWindow = currentRun().gitHost.mark(); })` in a support module (`support/https-git-host.ts`, which holds no module state). `mark()` returns `{ requests: log.length, connections: count }`. A log `Then` reads `requestsSince(this.requestWindow)`. This covers both `When` steps (`the user runs`, `the user starts a new pi session`), and no future `When` step can forget it. ESLint allows `BeforeStep` in support modules only [VERIFIED: eslint.config.js:329-344 bans only `Given/When/Then/defineStep` in `features/support/**`]. E11 verified that `pickleStep.type` is populated.
  - The alternative is an explicit `this.openRequestWindow()` in each `When` step. It is simpler to read, but a new `When` can forget it.
- Steps (wording is discretion; lower case, `these` before a table):
  - `Then the git host receives these requests:` with columns `| method | path | status |`, compared as strings, whole table, the D-01 example row form.
  - `Then the git host receives no request` asserts `{ requests: [], connections: 0 }` in the window.
- D-04: no uncompared-log enforcement. Do **not** add a `markRequestsCompared`.
- The window lives on the world (an initialized field). The log lives on the host (run state). The per-scenario reset clears the host log, so a window from a previous scenario can never apply.

### Pattern 6: Pi's typed extra env (DRV-03, D-10)

Today [VERIFIED: tests/e2e/_rpc.ts:167-174]:

```ts
function childEnvironment(sandbox: RpcSandbox): NodeJS.ProcessEnv {
  return {
    HOME: sandbox.home,
    PI_CODING_AGENT_DIR: sandbox.agentDir,
    PI_OFFLINE: "1",
    PATH: process.env.PATH ?? "",
  };
}
```

Recommended (a closed, typed interface, never a spread of `process.env`):

```ts
/** The git and trust settings the cucumber run adds to Pi's allowlist (DRV-03, HOST-01). */
export interface RpcGitEnvironment {
  readonly NODE_EXTRA_CA_CERTS: string;   // absolute path; must exist before start
  readonly GIT_CONFIG_NOSYSTEM: "1";
  readonly GIT_CONFIG_GLOBAL: string;     // <sandbox home>/.gitconfig, absent until a credential Given writes it
}
export async function startRpcPi(sandbox: RpcSandbox, git: RpcGitEnvironment): Promise<...>
```

Callers [VERIFIED: grep this session]: `startRpcPi` is called **only** by `features/lib/pi-process.ts:102`. `runRpcSession` (used by `tests/e2e/adapter-detection-rpc.test.ts`) shares `spawnPi`/`childEnvironment`. Give `spawnPi` an optional git env so `runRpcSession` is unchanged, or keep two spawn paths. Phase 10 will add `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` as an optional member.

What `git credential fill` inherits [VERIFIED: extensions/pi-claude-marketplace/platform/git-credential.ts:150-157]:

```ts
    const child = spawnProcess("git", ["credential", subcommand], {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
```

So the credential subprocess sees exactly Pi's allowlist plus those two keys. `GIT_CONFIG_NOSYSTEM` and `GIT_CONFIG_GLOBAL` reach it. The credential host is `new URL(...).host`, **including the port** [VERIFIED: orchestrators/auth-host.ts `hostFromCloneUrl`: `return new URL(gitHubWireUrl(cloneUrl)).host;`], and the `.git-credentials` line must carry the same `127.0.0.1:<port>` (E5).

**Credential `Given` (D-09) writes, with no git process:**

```
<sandbox home>/.gitconfig       →  "[credential]\n\thelper = store\n"
<sandbox home>/.git-credentials →  "https://<user>:<password>@127.0.0.1:<port>\n"   (mode 0600)
```

Verified end to end in E3: 401, then 200 and 200, `added`.

### Pattern 7: Url arms of `published-marketplace.ts` = dir writer + commit + push

Every `noStandIn` arm maps onto "write the same files the dir kind writes, but into a work tree, then publish a commit". Verified by E8 (30/32 rows pass with exactly this).

| Operation (today's function) | Url arm | Verified |
|------------------------------|---------|----------|
| `requireFreeRoot(root, directory, kind)` | Assert neither `work/<directory>` nor `repositories/acme/<directory>.git` exists, and return the work tree | E8 |
| `publishMarketplaceIn(root, directory, name, kind, plugins)` | `writeMarketplace(work, name, plugins, work/.claude-plugin/marketplace.json)` → `git init` (first time) → `add -A` → `commit` → `clone --bare work repositories/acme/<directory>.git` + `remote add origin` → return `{kind:"url", root: work, source: "https://127.0.0.1:<port>/acme/<directory>.git", manifestPath}` | E8 |
| `republishMarketplace` | `writeMarketplace` on the work tree → `commit` → `push origin main` | E8 (autoupdate rows) |
| `rewritePublishedManifest` | `writeManifestText` → commit + push | E8 (whitespace/order rows) |
| `invalidateManifest` | `MANIFEST_WRITERS[problem]` → commit + push | E8 (add/update invalid rows) |
| `describeMarketplace` | `writeMarketplaceDescription` → commit + push | E8 |
| `allowDependenciesOn` | `writeDependencyAllowance` → commit + push | (no `@url` row uses it; same shape) |
| `removePublishedSource` | Delete `repositories/acme/<directory>.git`. A later clone/fetch then sees a natural 404 | (no `@url` row uses it) |
| `publishedPluginFile` → used by `declarePublishedMcpServer` (writes `.mcp.json` itself) | **The API must change.** The caller writes after the function returns, so nothing commits. Recommend `writePublishedPluginFile(published, plugin, file, text)`, which writes with `flag:"wx"` and then commits for git kinds | (no `@url` row uses it today; world-and-stand-ins.md: a new kind changes library code only, so implement it) |
| `publishUnreadableSkillFile` | **Not representable in git.** `git add` fails: `error: open("plugins/zeta/skills/zeta-skill/notes.md"): Permission denied … fatal: adding files failed` (E8). See Open Question 2 | E8 (fails) |
| `publishConventionalDecoy`, `publishExternalMarketplace` | File kind only. No url arm | n/a |

Signature consequence: the arms need the git host (the URL base and repository root), but `features/lib` may not import `features/support` (layout.md). Pass a handle in. For example, the world exposes `this.gitHost`, and the publishing functions take a `{ marketplacesRoot, gitHost }` "publication sites" object instead of `marketplacesRoot: string`. The step *text* does not change. The step code passes one more argument. The scratch run imported `currentRun()` from support for speed. Do **not** copy that: it breaks layout.md and risks a fallow cycle.

### Anti-Patterns to Avoid

- **`--tags @url` for triage:** runs 0 scenarios. The CLI tags are ANDed with the profile's `not @url and not @github` (measured this session, and Phase 1 D-09). Use the alternate config (§Validation Architecture).
- **A second module-level server** outside `PiRun`. It breaks the slow-process rule, the hook order, and the replacement env.
- **Spreading `process.env`** into the Pi, CGI, or fixture-git env. A hook-run worker inherits `GIT_DIR`/`GIT_INDEX_FILE`, and the fixtures would write to this repository.
- **`execFileSync` for a git client in the worker that hosts the stand-in.** It deadlocks: the synchronous call blocks the event loop that must answer the request (it happened this session in E7's first attempt). Fixture commands that do not talk to the stand-in (`init`, `commit`, local `push`, `clone --bare` from a path) are safe synchronously, but use async `execFile` throughout for uniformity.
- **Asserting `state.json` or clone directories** in a `Then` (milestone invariant).
- **`NODE_TLS_REJECT_UNAUTHORIZED=0`** or a plain-HTTP stand-in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git smart-HTTP protocol | A pack/refs responder | `git http-backend` (CGI) | It is the real wire protocol. v1 and v2 both work (E1, E7) |
| Certificates | An X.509 builder | `openssl req -x509 …` | Node cannot create certs. One command, ~20 ms |
| Chunked request decoding | Your own dechunker | Node's `IncomingMessage` stream (already decodes) + buffer + `CONTENT_LENGTH` | Verified with real git `te=chunked` (E7) |
| Marketplace file contents | New writers for git | The existing `path-marketplace.ts` writers on a work tree | Byte-identical fixtures across kinds. The url arm only adds commit/push |
| Token substitution | A regex host:port normalizer | Exact `replaceAll("127.0.0.1:<port>", "{git host}")` in `run-tokens.ts` | A regex hides wrong-port/wrong-path bugs (milestone Pitfall 6) |
| Request-window bookkeeping per step | A call in every `When` | One `BeforeStep` keyed on `pickleStep.type === "Action"` | It cannot be forgotten (E11) |

## Runtime State Inventory

Not a rename/refactor phase. Omitted.

## Common Pitfalls

### Pitfall 1: Triage commands that check nothing
**What goes wrong:** `npx cucumber-js --tags @url` prints `0 scenarios` and exits 0. It looks green.
**Why:** The profile's `"tags": "not @url and not @github"` [VERIFIED: cucumber.json:6] is ANDed with the CLI `--tags`.
**How to avoid:** Use a scratch config file with `"tags": "@url"` and `-c` (exact command in §Validation Architecture). After the last plan removes `@url`, `--tags @url` works, because it is ANDed with `not @github`.
**Warning signs:** `0 scenarios` in the summary.

### Pitfall 2: The two un-runnable `@url` rows
See "Predicted `@url` failures" below. A wrong fix silently drops coverage.

### Pitfall 3: "No request" passing over a reused socket, or a non-TLS attempt
**What goes wrong:** (a) Node's https global agent keeps connections alive, so a regression request can travel over an existing socket. (b) A refused `http://{git host}/…` regressing into a plain-HTTP attempt never produces a `request` event (E12: only `connection` + `tlsClientError`).
**How to avoid:** "made no request" asserts zero requests **and** zero connections in the window. The reset calls `server.closeIdleConnections()`, so no keep-alive socket crosses scenarios.

### Pitfall 4: Worker crash on EPIPE, and orphaned CGI children
**What goes wrong:** An unhandled `'error'` on `child.stdin` (a drop while writing) or on `res` kills the cucumber worker. A CGI child of a timed-out request keeps running.
**How to avoid:** Attach `'error'` handlers to `child.stdin`, the `child` (spawn failure → respond 500 and log it), `req`, and `res`. Track children in a `Set`, kill them on `req` `'close'` and on reset, and await their `close` before asserting `children: 0`.

### Pitfall 5: Credential leaks through system config
**What goes wrong:** A dev box `/etc/gitconfig` names a credential helper (libsecret, osxkeychain), and a 401 scenario queries the real keychain.
**How to avoid:** Put `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=<sandbox home>/.gitconfig` in Pi's env (E5 proves NOSYSTEM ignores even `GIT_CONFIG_SYSTEM`).

### Pitfall 6: The SC6 plant no longer loads
**What goes wrong:** Planting `install-outcome.ts`, `plugin/shared.ts`, and `plugin/install-flow.ts` from `f78907bf` fails at import (E9). Pi would fail to load the extension, which is not a behavioral RED.
**How to avoid:** Use the equivalent local edit (§SC6). It was proven red on the three remove rows (E9).

### Pitfall 7: `requireFreeRoot` and releases for the url kind
The publish step registers `onRelease(rm(root))` for the root that `requireFreeRoot` returns. For url, that root is the work tree, and the bare repository survives until the reset. That is harmless, because the reset empties both, but the `requireFreeRoot` assertion must check both locations, so a second publish of the same directory in one scenario fails loudly.

## Predicted `@url` failures (measured, E8) and triage

| Row | Failure (measured) | Classification | Recommendation |
|-----|-------------------|----------------|----------------|
| `features/marketplace/info.feature:39` "Info shows the source identity and description" `@url` row (`https://{git host}/acme/tools.git#stable`) | The `Given … marketplace add …#stable` gets payload `{"kind":"internal-error","summary":"Command failed unexpectedly.","cause":{"causeChain":["Could not find stable."]}}` | **Wrong row** (the bare repo has no `stable` ref; the row passes when the fixture also pushes `main:stable`, measured with an env switch). **Plus a separate product finding:** a url add with a nonexistent ref ends in an unclassified `internal-error` | Correct the row to a ref every published repository has: `https://{git host}/acme/tools.git#main` with `source ref` = `main` (Phase 10's github row `acme/tools#main` follows). Do not add a hidden "every repo has a `stable` branch" fixture convention. A reader could not see it from the scenario. Record the `internal-error`-on-missing-ref behavior as an open question (D-13: user-visible change beyond the requirement wording → stop/ask; candidate BACKLOG item) |
| `features/marketplace/update.feature:885` "Autoupdate continues in installed order after a plugin fails" `@url` row (also its `@github` row in Phase 10) | The `Given … has an unreadable skill file` throws: git cannot index a mode-000 file. Even if staged another way, git stores only 644/755/symlink, and Pi's skill copy keeps symlinks verbatim (`bridges/skills/stage.ts:315-318` `dereference: false, verbatimSymlinks: true`), so no `permission denied` is reachable through a git-served plugin | **Wrong row** for git kinds (the failure mechanism is local-filesystem-only) | Needs a decision (Open Question 2): remove the `@url` and `@github` blocks, which leaves a 2-row Outline that breaks features.md's "three or more variants" rule, or switch every row of the Outline to a per-plugin failure a git host can serve. Ask before choosing; either way it is a row correction, not a product bug |

All other 30 `@url` scenarios passed, including:
- the four LAYER-07 Outlines;
- `update.feature:140` (cause chain `Marketplace "zeta" clone advanced but manifest could not be persisted., marketplace.json schema invalid: /plugins: must be array`, exactly as written);
- the `add.feature` duplicate-name rows (`tools-copy.git`);
- the whitespace, key-order, and array-order rows;
- every autoupdate row except the unreadable-file one;
- `remove.feature:31` (project and user);
- `autoupdate.feature:74`.

Inventory [VERIFIED: grep this session]: `@url` blocks per file are `add.feature` 6, `update.feature` 16, `remove.feature` 4, `info.feature` 1, `autoupdate.feature` 1, `plugin/cross-scope-install.feature` 1, for a total of **29 `@url` blocks, 32 scenarios**. The `@github` blocks number 27 (the "56" in the brief counts both tags).

## ADD-08 rows (refused forms)

Measured: every form gives `severity:error`, `summary:"A marketplace operation has failed."`, and a row `{name:<form as typed, with the port projected>, scope:project, status:failed, reasons:["unsupported source"], plugins:[]}`. Zero log rows (E6).

Parser reasons [VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:89-108, 352-355, 390-391, 622-649]: `http://`, `ssh://`, and `git@` become `"<raw> is not supported; <scheme> URLs are rejected -- only https:// URLs and local paths are accepted"` with scheme `"http://"`, `"ssh://"`, or `"git@host: scp-form"`. `~other/...` becomes `"per-user tilde (~user/...) is not supported; use ~/..."`. `/tree/` becomes `"<raw> is a browser URL; use https://github.com/<owner/repo>#<ref> instead"`. `https://github.com/o` becomes `"<raw> must be https://github.com/<owner>/<repo>[.git][#<ref>]"`. A bare word and `a/b/c` become `"non-relative string source <raw> cannot be classified"`. (The row carries only the reason token. These texts are internal reasons, not asserted.)

Recommended split (ADD-08 discretion; each row asserts "the git host receives no request"):

| Block | Rows | Why |
|-------|------|-----|
| untagged (no `source kind` column; runs from the plan that adds it) | `http://{git host}/acme/tools.git`, `ssh://{git host}/acme/tools.git`, `git@127.0.0.1:acme/tools.git`, `~other/marketplaces/tools` | Pointed at the stand-in where the form can name a port. A regression shows up as a connection (Pitfall 3). The scp form cannot carry a port, so it is typed literally, and the projected result shows it unchanged (E6). A `~other` regression would become a path source, which uses no network |
| `@github` (needs a `source kind` column with value `github`; runs in Phase 10) | `https://github.com/acme/tools/tree/main`, `https://github.com/acme`, `tools`, `acme/tools/extra` | A regression in these forms routes toward **github.com**. Without the Phase 10 override that would reach the public network and miss the stand-in log. With the override it hits the stand-in and is caught |

Gate facts [VERIFIED: scripts/check-features.mjs:357-386]: an untagged block may omit the `source kind` column. If it has one, it may hold only `dir`/`file`. A tagged block **must** have the column with its own kind only. Different Examples blocks of one Outline may have different headers (the existing `add.feature:230` block already does).

## Outline shape for `@url`+`@github` behaviors (re-add, empty logs)

- features.md: "A Scenario Outline is for three or more variants" counting all Examples rows. A url row must sit in an `@url` block (the gate forbids `url` in an untagged block).
- One url row plus one github row is 2 variants, which is too few. **Vary the scope**: `project` and `user` × `url` and `github` = 4 rows. That is meaningful, because each scope has its own clone directory.
- The empty-log verbs (`list`, `info`, `remove`) produce different payload shapes, and the world fails a passing scenario whose row arrays went uncompared. So use **one Outline per verb**, each varying scope. Do not use a single Outline over the three commands.
- These `@url` rows run in `npm run check` only from the last plan. Before that, they are verified with the alternate config (D-14).
- The single-kind url behaviors (SRC-01, 404, 5xx Outline 500/502/503, drop, 401 ×2, UPD-11 rows) are **untagged** Scenarios/Outlines in url-owned files with no `source kind` column. They run in every commit from the plan that adds them.

## SC6 red proof (D-15)

- The commit named by 03.2-07-SUMMARY: `6a656a9e` ("feat(plugin): add a user-scope marketplace to the project on install"). Its parent is `f78907bf` [VERIFIED: .planning/phases/03.2-marketplace-layer-partition/03.2-07-SUMMARY.md task 2: "**`6a656a9e`** … Plan 08 and ROADMAP Phases 9 and 10 plant the code from before the change from this commit's parent, `f78907bf`"]. Plan 08 planted `install-outcome.ts`, `plugin/shared.ts`, and `plugin/install-flow.ts` from `f78907bf`. Today those files fail to load (E9).
- **Equivalent local edit (proven, never committed):** in `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, at the end of `resolveTargetScopeMarketplace`, replace the `return addTargetScopeMarketplace(…, marketplaceAdd.record);` with the old record copy, which `cloneMarketplaceRecordForTargetScope` did at `f78907bf` (`{ ...sourceRecord, scope: targetScope, plugins: {} }` + `setOwn`):
  ```ts
  void marketplaceAdd;
  const copy = { ...source.sourceRecord, scope: opts.scope, plugins: {} };
  setOwn(state.marketplaces, marketplace, copy);
  return copy;
  ```
  `setOwn` is already imported there [VERIFIED: install-outcome.ts:123 `import { ownValue, setOwn } from "../../shared/own-key.ts";`]. Result (E9): "…keeps the plugins the project installed from it" (`remove.feature:685`), "…keeps the info of a plugin…" (`:725`), and "…keeps the marketplace updatable…" (`:757`) each fail at `Then the result has these fields:`. Update showed `severity error`, `summary "Some operations have failed."`, and info showed `summary "A plugin operation has failed."`. `cross-scope-install.feature` and `remove.feature:31` rows pass. After the restore, all 6 pass.
- Evidence file, per the Phase 7 convention [VERIFIED: 07-03-PLAN.md step 5]: `09-0N-RED.json` with `command`, `exitCode`, `output`, `targetTest`, `targetFile`, `expected`, `actual`, `semanticAssessment`, `nodeVersion`, `baseCommit`, `diff`, and `plantedFrom` (here: "equivalent local edit; f78907bf plant no longer loads"). Run it after the last plan removes `not @url`: `npm run --silent test:cucumber -- features/marketplace/remove.feature --parallel 1 --tags @url --name '<the three titles>' --format summary --format junit:<scratch>/red.xml`.

## Rule amendments (HOST-02, docs)

| File:line | Current text (excerpt) | Amendment |
|-----------|------------------------|-----------|
| `.agents/skills/cucumber/rules/world-and-stand-ins.md:10` | "One exception: a process under test that is too slow to start per scenario … may hold it as the run's only module-level state…" | Add: a stand-in whose address or trust the process fixes when it starts (the HTTPS git host: Pi reads the CA path and the port at start) shares that run state. The same `BeforeAll` starts it **before** the process, `Before()` resets it with the process and asserts it empty (repositories, arming, request log, connections, CGI children), and `AfterAll` stops it after the process. A replaced process gets the same environment |
| `.agents/skills/cucumber/rules/layout.md:56` | "…the run's only module-level state … `.agents/skills/cucumber/rules/steps.md` says how it starts, resets, and stops." | Same extension. Note: the cross-reference points at `steps.md`, but the start/reset/stop text lives in `world-and-stand-ins.md`. Fix the pointer while amending (the same sentence) |
| `.agents/skills/cucumber/rules/steps.md` | — | Add the request-log steps: a log step compares only the requests of the last `When` (D-02), and log steps appear only in url-owned files (D-03) |
| `.agents/skills/cucumber/rules/features.md:96,107` | exclusion text; `{git host}` mentioned as future | Document `{git host}` = `127.0.0.1:<port>` of the run's git host, expanded in commands and projected in results. In the last plan, change the exclusion to `not @github` |

## Code Examples

### Run token (exact substring, both directions)

```ts
// Source: features/lib/run-tokens.ts pattern (verified in E8 scratch suite)
export function expandTokens(text: string, tokens: RunTokens): string {
  return text.replaceAll(HOME_TOKEN, tokens.home).replaceAll(GIT_HOST_TOKEN, tokens.gitHost);
}
export function projectTokens(key: string, value: string, tokens: RunTokens): string {
  if (key === "lastUpdatedAt" && isScenarioTime(value, tokens.scenarioStartedAt)) { return SCENARIO_TIME_TOKEN; }
  return value.replaceAll(tokens.home, HOME_TOKEN).replaceAll(tokens.gitHost, GIT_HOST_TOKEN);
}
```

`tokens.gitHost` is `127.0.0.1:<port>` (host:port), so `https://{git host}/acme/tools.git` expands to the real URL. Verified projections: row names `https://{git host}/acme/t500.git`, cause frames `500 on https://{git host}/acme/t500.git`, info `source url` `https://{git host}/acme/tools` (identity form, `.git` stripped by `stripUrlDecorations`, source.ts:525-528), and the update 401 hint `host={git host}`.

### Commit-and-push publication (fixture)

```ts
// Source: E8 scratch git-host-exp.mjs (verified against 30 @url scenarios)
async function publishCommit(work: string, bare: string, env: NodeJS.ProcessEnv): Promise<void> {
  const fresh = !(await exists(path.join(work, ".git")));
  if (fresh) { await git(work, env, "init", "-q"); }
  await git(work, env, "add", "-A");
  await git(work, env, "commit", "-q", "--allow-empty", "-m", "publish");
  if (fresh) {
    await git(path.dirname(bare), env, "clone", "-q", "--bare", work, bare);
    await git(work, env, "remote", "add", "origin", bare);
  } else {
    await git(work, env, "push", "-q", "origin", "main");
  }
}
// git(...) = promisified execFile("git", ["-c","init.defaultBranch=main","-c","commit.gpgsign=false", ...args], { cwd, env })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FEATURES.md C-13: update 404 → `network unreachable` | Update 404/5xx → `network error` with a `{status} on {url}` frame (`hostHttpFailureFrame`) | Phase 6 (UPD-11 code) | UPD-11 scenarios pin `network error` for 404 too (measured) |
| Plant `f78907bf` install files for the LAYER-07 RED | Equivalent local edit in `resolveTargetScopeMarketplace` | Later phases changed `shared/errors.ts` | D-15's fallback is the only working route |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The openssl command works unchanged on CI's OpenSSL 3.0.13 | Standard Stack | The walking skeleton fails on CI only. Mitigation: the first plan's CI run proves it |
| A2 | Node 24 produces the same `socket hang up` and status phrases as Node 22/26 | Measured payloads | A Node 24-only text mismatch on the update-drop row (CI runs Node 24) |
| A3 | `check:features` dry-run loads support modules without running `BeforeAll` | Pattern 1 | If wrong, the gate would start a stand-in. It already starts no Pi today, so low risk |
| A4 | `git http-backend` is reachable as `git http-backend` on ubuntu-latest (`/usr/lib/git-core`) | Standard Stack | Spawn failure on CI. Verified on Fedora only |
| A5 | Dropping `@url`/`@github` from the unreadable-skill Outline (or changing its failure) is a "row correction" under D-13 rather than needing user sign-off | Predicted failures | It removes coverage or rewrites passing dir/file rows. Treat as needing confirmation |
| A6 | Correcting the info row's ref from `#stable` to `#main` is an acceptable "wrong row" correction | Predicted failures | It changes a Phase 5 row. Low risk; the behavior shown (ref in info) is kept |

## Open Questions

1. **Url add with a ref that does not exist yields `internal-error`.**
   - What we know: `marketplace add https://{git host}/acme/tools.git#stable` with no `stable` ref emits `{"kind":"internal-error","summary":"Command failed unexpectedly.","cause":{"causeChain":["Could not find stable."]}}` (E8). `classifyAddError` has no arm for isomorphic-git's `NotFoundError`.
   - What's unclear: whether that should be a classified reason (for example `source missing`). It is a user-visible change beyond Phase 9's requirement wording.
   - Recommendation: per D-13, do not fix in this phase without the user. Correct the info row to `#main` and record the finding (BACKLOG or user question).
2. **The unreadable-skill autoupdate Outline's `@url` (and Phase 10 `@github`) rows cannot run against a git host.**
   - What we know: git cannot carry mode-000 files or FIFOs, and symlinks are copied verbatim (no EACCES).
   - Options: (a) remove both tagged blocks and accept a 2-row Outline (features.md WARNING), or convert it into two Scenarios; (b) change the failure mechanism for every row to one a git host can serve (it must yield the same reason for all kinds, and the existing dir/file rows change).
   - Recommendation: ask the user, presenting (a) as the minimal correction.
3. **Synthetic child row `id` on a failed url add is `<url>@<url>`** (for example `https://{git host}/acme/t500.git@https://{git host}/acme/t500.git`). Known as 03.2-REVIEW IN-04. Scenarios that compare the plugin-row table must state it (the row steps compare every column). Recommendation: pin it as it is (scenarios pin the code) and note it in the SUMMARY.
4. **Which step module owns the git-host steps.** layout.md requires a vertical name. Options: `step_definitions/marketplace/url-source.steps.ts` (verb-free topic) or `step_definitions/git-host.steps.ts` (the function "git host"). Recommendation: a topic module named for the stand-in's user-visible role is acceptable, because the log is something the user "sees" through the scenario. The planner picks.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git (+ http-backend) | HOST-01, fixtures | ✓ | 2.55.0 (`/usr/libexec/git-core/git-http-backend`) | — |
| openssl | HOST-01 cert | ✓ | 4.0.3 local; 3.0.13 CI (cited) | — |
| Node | Pi, worker | ✓ | 26.11.1 (brew), 22.22.2 (`/usr/bin/node`); CI Node 24 | — |
| isomorphic-git | inside Pi | ✓ | 1.42.3 | — |
| Pi CLI | RPC child | ✓ | @earendil-works/pi-coding-agent 1.0.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | @cucumber/cucumber 13.3.0 (behavioral), node:test (unit, `tests/architecture/`) |
| Config file | `cucumber.json` (`"tags": "not @url and not @github"`, `parallel: 8`, `order: random`) |
| Quick run command | `npx cucumber-js --parallel 1 features/marketplace/url-source.feature` (untagged url-only scenarios) |
| `@url` triage (before last plan) | `printf '%s' '{"default":{"import":["features/support/**/*.ts","features/step_definitions/**/*.steps.ts"],"format":["progress"],"order":"random","tags":"@url","parallel":4}}' > "$SCRATCH/cucumber-url.json" && npx cucumber-js -c "$SCRATCH/cucumber-url.json"` (verified: 32 scenarios run; `--tags @url` alone runs 0) |
| Unit tests | `node --test tests/architecture/<lib>.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOST-01 | A url add clones over HTTPS from 127.0.0.1 with a run-time cert, and the log shows `GET …/info/refs?service=git-upload-pack 200`, `POST …/git-upload-pack 200` | behavioral | `npx cucumber-js --parallel 1 features/marketplace/url-source.feature --name 'clones'` | ❌ Wave 0 |
| HOST-01 | No `NODE_TLS_REJECT_UNAUTHORIZED` anywhere; no committed key | acceptance grep | `! rg -n 'NODE_TLS_REJECT_UNAUTHORIZED\|BEGIN (EC )?PRIVATE KEY' features tests/e2e` | n/a |
| HOST-01 | CGI header parser | unit | `node --test tests/architecture/<cgi-parser>.test.ts` | ❌ Wave 0 |
| HOST-02 | Reset empties repos, arms, log, connections, children before every scenario; random order proves no leak | behavioral (every scenario's `Before`) | `npm run test:cucumber` (×2 runs, random seeds) | ✅ extended |
| HOST-02 | Skill rule allows the lifetime | doc review | `rg -n 'git host\|stand-in whose' .agents/skills/cucumber/rules/` | ❌ |
| HOST-03 | 401 / 404 / 500 / 502 / 503 / drop arms | behavioral | url-source.feature + url-source-update.feature scenarios | ❌ |
| HOST-04 | Exact log table; empty log | behavioral | log steps in url-owned files | ❌ |
| DRV-03 | Env builders: no inherited `GIT_*`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL` set (test sets `process.env.GIT_DIR` etc. with `t.after` restore and compares the whole object) | unit | `node --test tests/architecture/<git-marketplace\|https-git-host>.test.ts` | ❌ Wave 0 |
| DRV-03 | 401 without credential stays `authentication required`; with a sandbox credential it succeeds | behavioral | url-source.feature 401 scenarios | ❌ |
| DRV-03 | Hostile system/global helper changes no result | manual (D-11, by hand once, SUMMARY) | Local uncommitted edit adds `GIT_CONFIG_SYSTEM=<hostile file whose helper writes a marker and prints the arm's correct user/password>` to Pi's env → 401-without-credential scenario still fails as `authentication required`, no marker. Then also drop `GIT_CONFIG_NOSYSTEM` → the same scenario now **passes the add** (positive control, E5 shape) → restore | manual-only (no committed negative control, CONVENTIONS) |
| ADD-08 | 4 untagged refused rows → `unsupported source`, no request (connections included) | behavioral | url-source.feature refused Outline | ❌ |
| ADD-09 | Armed 404 → `source missing` | behavioral | url-source.feature | ❌ |
| ADD-10 | 500/502/503 Outline → `network error`, cause `<status> on https://{git host}/acme/tools.git`, `HTTP Error: <status> <phrase>`; drop → `network unreachable` | behavioral | url-source.feature | ❌ |
| ADD-12 | Remove then add again from the same source → `added`, log shows a fresh clone | behavioral (`@url`, last plan; triage via alt config) | git-source.feature re-add Outline | ❌ |
| RM-09 / LS-05 / INFO-07 | Remove / list / info of a git marketplace → empty log | behavioral (`@url`) | git-source.feature, one Outline per verb, scope-varied | ❌ |
| UPD-11 | Update vs 500/502/503/404 → `network error` with frame; drop → `network unreachable` (cause `Failed to update marketplace "tools".`, `socket hang up`) | behavioral | url-source-update.feature | ❌ |
| SRC-01 | Typing `https://{git host}/acme/tools` logs `/acme/tools/info/refs…` and `/acme/tools/git-upload-pack` (no `.git`), and the config declares the typed URL | behavioral | url-source.feature | ❌ |
| SC5 | `@url` removed from the exclusion; all `@url` rows pass | behavioral | `npm run test:cucumber` after `"tags": "not @github"` | ✅ (rows exist) |
| SC6 | Three remove rows RED on the edit, GREEN restored | behavioral + evidence | the command in §SC6 → `09-0N-RED.json` | ❌ |

### Sampling Rate
- **Per task commit:** `npm run check:commit` (static + `tests/architecture/**`; no cucumber) **plus** the targeted cucumber file the task touched (`npx cucumber-js --parallel 1 <feature>`), because `check:commit` skips cucumber.
- **Per wave merge:** `npm run check`. Before the last plan, also the `@url` alternate-config run.
- **Phase gate:** `npm run check` green with `"tags": "not @github"`, and two random-order `npm run test:cucumber` runs.

### Wave 0 Gaps
- [ ] `features/lib/https-git-host.ts` (+ parser module) — HOST-01/03/04
- [ ] `features/lib/git-marketplace.ts` — the fixture and the fixture-git env (DRV-03, D-12)
- [ ] `tests/e2e/_rpc.ts` typed git env; `features/lib/pi-process.ts` pass-through
- [ ] `features/support/pi-process.ts` lifetime + reset assertion; `features/support/https-git-host.ts` `BeforeStep` window
- [ ] `features/lib/run-tokens.ts` `{git host}`; `features/support/world.ts` `tokens.gitHost`, `requestWindow`
- [ ] `tests/architecture/<…>.test.ts` — parser + env builders
- [ ] Framework install: none

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it counts as enabled. The surface is test-only: a loopback server and credential fixtures.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (test fixture only) | Basic-auth arm compares the whole `Authorization` header with one scenario credential. The log records the status only, never the header value |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `PATH_INFO` is passed to http-backend with `GIT_PROJECT_ROOT`. http-backend itself refuses paths outside the root. Bind `127.0.0.1` only |
| V6 Cryptography | yes | openssl-generated EC P-256 cert, 1-day validity, per worker, never committed. TLS verification stays on (`NODE_EXTRA_CA_CERTS`, never `NODE_TLS_REJECT_UNAUTHORIZED`) |
| V8 Data Protection | yes | `.git-credentials` lives only under the per-run sandbox HOME, which `Before()` empties. The real `~/.git-credentials` and keychain are unreachable (`GIT_CONFIG_NOSYSTEM`, sandbox `GIT_CONFIG_GLOBAL`, sandbox HOME) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A 401 reaches the developer's credential helper or keychain | Information disclosure | `GIT_CONFIG_NOSYSTEM=1` + sandbox `GIT_CONFIG_GLOBAL` + sandbox HOME (E5); D-11 by-hand control |
| Fixture git writes into this repository (inherited `GIT_DIR`) | Tampering | Env built from scratch for fixture git and CGI (D-12) |
| Stand-in reachable off-host | Information disclosure | `listen(0, "127.0.0.1")` |
| Private key committed / scanned | Information disclosure | Run-time generation under the run root, removed in `AfterAll`. TruffleHog filesystem hook |
| Refused GitHub-form regression hits github.com | Information disclosure (public network) | GitHub-form rows wait for the override (`@github`) |

## Sources

### Primary (HIGH confidence)
- Session experiments E1–E12 (scratch scripts `scratchpad/scripts/{standin,run-exp,realgit,drop,plain}.mjs`, scratch suite copy `scratchpad/suite`): real Pi RPC + extension + `git http-backend` + isomorphic-git 1.42.3.
- Codebase reads: `tests/e2e/_rpc.ts`, `features/{support,lib,step_definitions}/**`, `features/marketplace/*.feature`, `extensions/pi-claude-marketplace/{shared/git-failure-classifiers.ts, domain/source.ts, platform/git-credential.ts, platform/git.ts, orchestrators/auth-host.ts, orchestrators/marketplace/add.ts, orchestrators/plugin/install-outcome.ts}`, `scripts/check-features.mjs`, `scripts/check-corresponding-tests.mjs`, `eslint.config.js`, `.fallowrc.json`, `.github/workflows/ci.yml`, `.pre-commit-config.yaml`, `package.json`, `cucumber.json`.
- `node_modules/@earendil-works/pi-coding-agent/dist/{main.js, core/http-dispatcher.js, core/model-runtime.js, core/package-manager.js, utils/version-check.js, utils/tools-manager.js}`.
- `.planning/phases/03.2-marketplace-layer-partition/03.2-07-SUMMARY.md`, `03.2-08-SUMMARY.md`; `07-03-PLAN.md` (RED.json shape).

### Secondary (MEDIUM confidence)
- `.planning/research/{SUMMARY,STACK,PITFALLS}.md` (milestone research, 2026-10-15): CI image versions, openssl flag portability, git-http-backend docs on `GIT_PROTOCOL`/`GIT_HTTP_EXPORT_ALL`.

### Tertiary (LOW confidence)
- None used for recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (local probes; CI versions MEDIUM, cited).
- Architecture: HIGH (the whole lifetime/arms/token design ran in a scratch suite against 313 + 32 scenarios).
- Pitfalls: HIGH (each reproduced or measured: tag AND-ing, EPIPE/handlers inferred from Node semantics, keep-alive/plain-HTTP measured, plant load failure measured).

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (stable stack; re-check if `ubuntu-latest` moves to 26.04 in November 2026)
