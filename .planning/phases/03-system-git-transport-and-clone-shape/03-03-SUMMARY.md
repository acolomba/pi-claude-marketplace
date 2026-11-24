---
phase: 03-system-git-transport-and-clone-shape
plan: "03"
subsystem: testing
tags: [cucumber-harness, connect-proxy, git-http-backend, hermetic-env, system-git]

requires: []
provides:
  - "startGitHubConnectProxy: loopback CONNECT proxy that tunnels github.com:443 to the https git host stand-in, refuses everything else, and logs to github-redirect.jsonl"
  - "https git host certificate that also names DNS:github.com"
  - "git host forwards git http-backend's own answer after a non-zero exit (upload-pack's 'not our ref')"
  - "HermeticGitVariables.https_proxy, so a suite git can name the harness proxy"
  - "hermetic leak check plants CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS and CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE"
affects: [device-flow-profile, transport-swap, request-table-rebaseline, sha-ladder-scenarios]

actuals:
  tokens: 7367
  tasks: 2
  commits: 2
plan_head_before: e8fbff279978c0beaba3dbb5c5d31741ce4b8724
plan_head_after: 3f800d6e1b45e69270f984371ca6f239a52607ce

tech-stack:
  added: []
  patterns:
    - "A harness stand-in that only an architecture test calls yet carries one fallow unused-export marker and inline option/result types, so the consumer that lands later removes exactly one marker"
    - "A proxy stand-in logs in the GitHub redirect's own RedirectLogLine format, so the existing routing step reads it unchanged"

key-files:
  created:
    - features/lib/github-device-flow/connect-proxy.ts
    - test/architecture/github-device-flow-connect-proxy.test.ts
  modified:
    - features/lib/https-git-host/server.ts
    - features/lib/https-git-host/cgi.ts
    - features/lib/github-device-flow/server.ts
    - features/lib/hermetic-git.ts
    - test/architecture/https-git-host-server.test.ts
    - test/architecture/https-git-host-cgi.test.ts
    - test/architecture/hermetic-git-environment.test.ts

key-decisions:
  - "The proxy refuses plain (non-CONNECT) proxy requests with 403 and logs them as refused, as well as every CONNECT target but github.com:443, so nothing fails open (T-03-06)"
  - "runHttpBackend forwards a non-zero backend exit only when it printed a whole header block and an exit code ended it; a signal-ended backend still fails 500, so a killed backend's truncated body is never forwarded"
  - "The proxy test names https_proxy through HermeticGitVariables rather than -c http.proxy, so it runs git the way Pi's environment will"

patterns-established:
  - "Stand-in CONNECT proxy: http.Server 'connect' handler, exact-match allowlist of one target, every socket tracked so close() ends open tunnels"

requirements-completed: ["SG-TRN-01", "SG-TRN-05", "SG-TRN-06"]

coverage:
  - id: D1
    description: "A real system git asks for https://github.com/acme/tools.git through the CONNECT proxy, reaches only the git host stand-in, verifies it with the harness CA, and the routing log records one routed CONNECT"
    requirement: "SG-TRN-01"
    verification:
      - kind: integration
        ref: "test/architecture/github-device-flow-connect-proxy.test.ts#tunnels a system git's request for github.com to the git host and logs one routed CONNECT (D-SG-14)"
        status: pass
      - kind: integration
        ref: "test/architecture/https-git-host-server.test.ts#names github.com beside 127.0.0.1 in its certificate, so a tunnel for github.com verifies it (D-SG-14)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A CONNECT to any other target is refused with 403 before a byte reaches it and logged as refused"
    requirement: "SG-TRN-01"
    verification:
      - kind: integration
        ref: "test/architecture/github-device-flow-connect-proxy.test.ts#refuses a CONNECT to any other target before a byte reaches it, and logs the refusal"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two concurrent gits get a tunnel each; close() ends every open tunnel and frees the port"
    requirement: "SG-TRN-01"
    verification:
      - kind: integration
        ref: "test/architecture/github-device-flow-connect-proxy.test.ts#gives two git processes started together a tunnel each"
        status: pass
      - kind: integration
        ref: "test/architecture/github-device-flow-connect-proxy.test.ts#ends every open tunnel and frees its port when it closes"
        status: pass
    human_judgment: false
  - id: D4
    description: "The git host forwards upload-pack's own refusal of an unknown want: git sees 'fatal: remote error: upload-pack: not our ref <sha>' and the host logs POST git-upload-pack 200; a backend that fails without a header block still answers 500"
    verification:
      - kind: integration
        ref: "test/architecture/https-git-host-server.test.ts#forwards upload-pack's refusal of a commit it does not have, so git reports its own error (SG-HRN-02)"
        status: pass
      - kind: unit
        ref: "test/architecture/https-git-host-cgi.test.ts#runHttpBackend (three cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The hermetic leak check plants CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS and CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE, and every exact key-set case still holds"
    requirement: "SG-TRN-05"
    verification:
      - kind: unit
        ref: "test/architecture/hermetic-git-environment.test.ts (all cases)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 03: Harness CONNECT Proxy and Backend-Refusal Forwarding Summary

**Cucumber-harness groundwork for system git. A loopback CONNECT proxy tunnels only `github.com:443` to the https git host stand-in and logs each tunnel in the GitHub redirect's line format. The stand-in's certificate now names `github.com`. The git host forwards upload-pack's own `not our ref` refusal instead of a made-up 500. The hermetic leak check plants the two upstream `CLAUDE_CODE_PLUGIN_*` git variables.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-11-24T02:32:36Z
- **Completed:** 2026-11-24T02:54:46Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `features/lib/github-device-flow/connect-proxy.ts`: `startGitHubConnectProxy({ gitHost, logPath })` binds `127.0.0.1:0`. It tunnels `CONNECT github.com:443` to the git host's loopback port and answers every other CONNECT target, and every plain proxy request, with 403 before it opens any connection. It appends one `RedirectLogLine` per decision to the log it is given. `close()` destroys every tracked socket, and a second call waits for the first.
- A real `git ls-remote https://github.com/acme/tools.git HEAD` with `https_proxy` and only the harness CA lists the stand-in's `HEAD`. Two concurrent gits each get a tunnel. Closing the proxy ends open tunnels, and the port then refuses connections.
- The git host's certificate SAN is `IP:127.0.0.1,DNS:github.com` (D-SG-14).
- `runHttpBackend` resolves when the backend exits non-zero after printing a whole header block. A `git fetch --depth 1 origin <unknown sha>` now fails with `fatal: remote error: upload-pack: not our ref <sha>` over `POST .../git-upload-pack 200`. Before, it failed with `HTTP 500` and `expected 'acknowledgments'`.
- `hermetic-git-environment.test.ts` plants `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` and `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, and every exact key-set case still passes (SG-TRN-05, SG-TRN-06).

## Task Commits

Each task was committed atomically. Each commit holds its RED test and its GREEN code together, because the commit hook runs typecheck and every architecture test, so a commit with only a failing test cannot pass it. The RED runs were made locally and are recorded below.

1. **Task 03-03-01: System git reaches the git host as github.com through a refusing CONNECT proxy**: `939f0ff` (test)
2. **Task 03-03-02: The git host forwards the backend's refusal, and the hermetic check plants the two new variables**: `3f800d6` (test)

**Plan metadata:** the SUMMARY commit that follows this file.

## TDD Evidence

### Task 1 RED

Command: `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=spec test/architecture/github-device-flow-connect-proxy.test.ts test/architecture/https-git-host-server.test.ts`. The proxy was a skeleton that listened and tunneled nothing, and `server.ts` still had the old SAN.

- 4/4 proxy cases failed on the planned behavior:
  - `tunnels a system git's request ...`: `SystemGitError: git ls-remote https://github.com/acme/tools.git HEAD failed with exit code 128: fatal: unable to access 'https://github.com/acme/tools.git/': Proxy CONNECT aborted`
  - `refuses a CONNECT ...` and `ends every open tunnel ...`: `Error: the proxy closed the connection before it answered:` (no refusal status, no tunnel)
  - `gives two git processes ...`: `Proxy CONNECT aborted`
- SAN case: `AssertionError: Expected values to be strictly deep-equal`. The actual value `['IP Address:127.0.0.1']` lacked `'DNS:github.com'`.
- Semantic assessment: each target test executed and failed on its own assertion, and git reached the proxy and was refused a tunnel. There was no load, syntax, or fixture fault. The first RED attempt hung in the refusal case, because the raw-CONNECT reader never noticed a close. I fixed the reader to fail on an early close before taking the RED above.

### Task 1 GREEN

The same command: `tests 23, pass 23, fail 0`.

### Task 2 RED

Command: `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=spec test/architecture/https-git-host-cgi.test.ts test/architecture/https-git-host-server.test.ts test/architecture/hermetic-git-environment.test.ts`, run against the old `runHttpBackend`. Result: `tests 61, pass 59, fail 2`.

- `resolves with the output of a backend that printed its header block and then exited non-zero`: `Error: git http-backend exited 128:`
- `forwards upload-pack's refusal ...`: `AssertionError: The input did not match /fatal: remote error: upload-pack: not our ref 0123…567/`. The actual stderr was `error: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500\nfatal: expected 'acknowledgments'\n`.
- Semantic assessment: both targets failed on the planned assertion for the intended reason, which is the made-up 500. The two "rejects ..." rows and the planted-variable rows passed on the old code, as intended: they guard behavior the fix must keep.

### Task 2 GREEN

The same command: `tests 61, pass 61, fail 0`.

### Final run

All five touched test files, the redirect test included: `tests 77, pass 77`. typecheck, `npm run fallow`, and ESLint on every touched file are clean. Both commit hooks ran `npm run check:commit`, and it passed.

## Lines for later plans

- **Start signature:** `startGitHubConnectProxy(options: { readonly gitHost: string; readonly logPath: string }): Promise<{ readonly address: string; close(): Promise<void> }>`. `gitHost` is `HttpsGitHost.address` (`127.0.0.1:<port>`; any other host throws). `logPath` is `path.join(harnessDirectory(home), GITHUB_REDIRECT_LOG)`, and the proxy makes its directory. Pi's `https_proxy` is `http://${proxy.address}`. Register `close()` with `this.onRelease()`.
- **Log entry shape:** the existing `RedirectLogLine` of `extension.ts`. A tunnel is `{"decision":"routed","method":"CONNECT","url":"github.com:443","target":"git host"}`. A refusal is `{"decision":"refused","method":"CONNECT","url":"<host>:<port>"}`; a plain proxy request is refused the same way with its own method and URL. So `Then pi routes these github requests:` shows a tunnel as the row `| CONNECT | github.com:443 | git host |`.
- **CONNECT count (03-RESEARCH A6), measured with git 2.43.0:** one `CONNECT` line, over one TLS connection, for each git process. That held for `ls-remote` (GET+POST), a full `clone` (GET+POST+POST), `clone --depth 1` (GET+POST+POST), a `fetch` in a clone (GET+POST), and `fetch --depth 1 origin HEAD` (GET+POST+POST). Not measured: a git that gets 401 and retries with a credential inside one process.
- **fallow marker to remove:** `startGitHubConnectProxy` carries `// fallow-ignore-next-line unused-export -- ...`, because only its architecture test calls it. When the Device Flow profile adopts the proxy, fallow reports the marker as stale, and that plan removes it.
- **Hermetic key sets:** `HermeticGitVariables` now has `https_proxy`. When `rpcChildEnvironment` gains `https_proxy` for the Device Flow profile, `hermetic-git-environment.test.ts`'s exact `rpcChildEnvironment` key sets must learn it. The runner's planted `https_proxy` (`http://shell-proxy.example:1`) is already in `INHERITED_VARIABLES`.
- **SHA ladder rows:** a want of an unknown SHA over the default (protocol v2) policy now reaches git as `fatal: remote error: upload-pack: not our ref <sha>` with HTTP 200. Under the `refuse-sha-want` arm (v0), git refuses on its own side with `Server does not allow request for unadvertised object`, after only `GET info/refs 200`.

## Files Created/Modified

- `features/lib/github-device-flow/connect-proxy.ts`: the CONNECT proxy stand-in (created)
- `test/architecture/github-device-flow-connect-proxy.test.ts`: real-git proof of the tunnel, the refusal, the log, concurrency, and close (created)
- `features/lib/https-git-host/server.ts`: certificate SAN `DNS:github.com`; comment on forwarded backend answers
- `features/lib/https-git-host/cgi.ts`: `runHttpBackend` forwards a whole-header-block answer after a non-zero exit
- `features/lib/github-device-flow/server.ts`: `listenOnLoopback` exported and typed over `net.Server`, so the proxy reuses it
- `features/lib/hermetic-git.ts`: `HermeticGitVariables.https_proxy`
- `test/architecture/https-git-host-server.test.ts`: SAN row and the `not our ref` row
- `test/architecture/https-git-host-cgi.test.ts`: three `runHttpBackend` rows
- `test/architecture/hermetic-git-environment.test.ts`: the two planted variables

## Decisions Made

- The proxy also refuses plain proxy requests (non-CONNECT), with 403 and a refused log line, so an `http://` request through it cannot fail open.
- The proxy matches the CONNECT target exactly (`github.com:443`). Any other spelling is refused, which is the safe direction.
- A non-zero backend exit is forwarded only when an exit code (not a signal) ended the backend and its output holds a whole header block. So the reset's SIGKILL of a CGI child still logs 500 or dropped, and never forwards a truncated body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `https_proxy` added to `HermeticGitVariables`**
- **Found during:** Task 1
- **Issue:** The behavior runs git "with `https_proxy=...`", but the hermetic builder accepts only named variables, and none was a proxy. `features/lib/hermetic-git.ts` is not in `files_modified`.
- **Fix:** I added an optional `https_proxy` key with a D-SG-14 comment. Calls that do not name it are unchanged, and the hermetic key-set cases still pass.
- **Files modified:** `features/lib/hermetic-git.ts`
- **Commit:** `939f0ff`

**2. [Rule 3 - Blocking] Shared `listenOnLoopback` instead of a copy**
- **Found during:** Task 1
- **Issue:** `npm run fallow` (dupes) reported the proxy's listen helper as a clone of the one in `features/lib/github-device-flow/server.ts`, which is not in `files_modified`.
- **Fix:** I exported `listenOnLoopback` from that file, typed it over `net.Server`, made its error message neutral (nothing asserts it), and imported it in the proxy.
- **Files modified:** `features/lib/github-device-flow/server.ts`, `features/lib/github-device-flow/connect-proxy.ts`
- **Commit:** `939f0ff`

**3. [Rule 3 - Blocking] fallow unused-export marker and inline types**
- **Found during:** Task 1
- **Issue:** fallow dead-code reported `startGitHubConnectProxy` and its two exported interfaces as unused, because only the architecture test consumes them until the Device Flow profile adopts the proxy.
- **Fix:** I followed the `terminalScreen` precedent: one `fallow-ignore-next-line unused-export` marker with a justification, and inline option and result types, so no type export needs a marker of its own. The test derives the type with `Awaited<ReturnType<...>>`.
- **Files modified:** `features/lib/github-device-flow/connect-proxy.ts`, `test/architecture/github-device-flow-connect-proxy.test.ts`
- **Commit:** `939f0ff`

**4. [Rule 2 - Missing critical] Plain proxy requests refused and logged**
- **Found during:** Task 1
- **Issue:** The plan names only CONNECT. Without a `request` handler, a plain `GET http://...` through the proxy would get Node's default answer and leave no log line.
- **Fix:** A `request` handler answers 403 and logs `{ decision: "refused", method, url }` (T-03-06 fail-closed).
- **Commit:** `939f0ff`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing critical). **Impact on plan:** each change is small and inside the harness. No product code changed, and the scope did not grow.

## Issues Encountered

- The worktree has no optional-peer cache (`node_modules/.cache/optional-peers`), so an extra cucumber smoke run of `features/marketplace/device-flow.feature` stopped in `BeforeAll` with `the peer cache holds no pi-mcp-adapter`. Filling the cache is a package install, so I did not run it. The plan does not ask for this run: no scenario uses the proxy yet, and isomorphic-git ignores the certificate name and the forwarding. The orchestrator's wave gate runs `npm run check`, which installs the peers and runs cucumber.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. Each task's commit holds both RED and GREEN, as the session instructions require, because the hook runs every architecture test. The RED evidence above was taken from real runs before each implementation. There is no separate `test(...)` RED commit, so any gate that looks for one finds none.

## User Setup Required

None. No external service configuration is required.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and no stub, skipped test, or unrun plan `<verify>` remains.

## Threat Flags

None. No security-relevant surface outside the plan's `<threat_model>` was introduced. The proxy is the T-03-06 surface the plan names; it binds loopback only and tunnels to one loopback port.

## Next Phase Readiness

- The transport swap can switch the Device Flow profile to `https_proxy=http://<proxy>` and re-baseline its routing tables with one `CONNECT github.com:443` row per git process.
- The SHA ladder scenarios can rely on git's own `not our ref` error through the stand-in.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*

## Self-Check: PASSED

- FOUND: features/lib/github-device-flow/connect-proxy.ts
- FOUND: test/architecture/github-device-flow-connect-proxy.test.ts
- FOUND: 939f0ff (ancestor of HEAD)
- FOUND: 3f800d6 (ancestor of HEAD)
