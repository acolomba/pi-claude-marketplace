---
phase: 06-mcp-servers
plan: 02
subsystem: testing
tags: [cucumber, pi-mcp-adapter, mcp, streamable-http, loopback-stand-in, variables, oauth]

requires:
  - phase: 06-mcp-servers
    provides: "06-01 shared MCP steps (stub-servers file Given, launch-environment Given, stub listing wait, stub messages Then) and features/lib/mcp-server-files.ts"
provides:
  - "features/mcp-server/configuration.feature: the MCP-03 configuration scenarios (10, one an Outline of 4 rows)"
  - "features/lib/mcp-server-http.ts: the loopback Streamable HTTP MCP stand-in and its request-log reader"
  - "features/lib/mcp-server-environment.ts: the --import preload that tags the stub's echo with variables of its own process"
  - "features/step_definitions/mcp-server/configuration.steps.ts: the http server Given, listing wait, and two request Thens; the environment-echo Given"
affects: [06-06, 06-08, 06-09]

actuals:
  tokens: 8839
  tasks: 3
  commits: 3
plan_head_before: 38f3900e2eae43d2ac45a3fef8cb3aee95395a16
plan_head_after: 26de41d8d154aa699eab6a3fadd5e0d124bd6da9

tech-stack:
  added: []
  patterns:
    - "Loopback HTTP stand-in started in a Given, closed in the scenario's release, logging one JSON line per request to the harness directory"
    - "Concurrent HTTP traffic stated in two whole partitions: the JSON-RPC POSTs in arrival order, every other request in any order"
    - "A Node --import preload that changes a frozen stand-in's observable output without editing it"

key-files:
  created:
    - features/mcp-server/configuration.feature
    - features/step_definitions/mcp-server/configuration.steps.ts
    - features/lib/mcp-server-http.ts
    - features/lib/mcp-server-environment.ts
  modified: []

key-decisions:
  - "The HTTP requests step states the POSTs in arrival order and the GETs in any order, because the SDK's event-stream GET reaches the server about 1 ms before or after the concurrent POST tools/list"
  - "The end of pi-mcp-adapter's HTTP startup listing is the first logged tools/list: the adapter sends no DELETE, and its keep-alive sockets stay open until the release"
  - "A header the request did not carry shows as (none), so an empty value and a missing header read differently"
  - "The configuration Givens write .mcp.json through the frozen writePublishedPluginFile, because a lone server named stub reads as a 06-01 stub marker"

patterns-established:
  - "HTTP MCP stand-ins answer from a small table keyed by JSON-RPC method, 202 to a notification, 405 to any other HTTP method"

requirements-completed: [MCP-03]

coverage:
  - id: D1
    description: "A type http server with Authorization: Bearer t0k3n and X-Team: ${PI_CM_TEAM} receives both headers on every request, X-Team as core from Pi's environment at connect time, and the scripted mcp call returns mcp returned: echo:ping"
    requirement: MCP-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A loopback remote server receives the plugin's headers, a variable among them expanded when it connects"
        status: pass
    human_judgment: false
  - id: D2
    description: "An env value reaches the stub as Claude Code expands it: literal, ${CLAUDE_PLUGIN_DATA}, ${CLAUDE_PLUGIN_ROOT}, ${PI_CM_STUB_TAG:-install-default} with the variable unset (D-CF1-13)"
    requirement: MCP-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A server's env value reaches it as Claude Code expands it (4 rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A ${PI_CM_STUB_TAG} env reference takes the value Pi starts with (late)"
    requirement: MCP-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A variable reference in env reaches the server with the value Pi starts with"
        status: pass
    human_judgment: false
  - id: D4
    description: "${CLAUDE_PLUGIN_ROOT} in args reaches the stub as {home}/marketplaces/fixtures/plugins/demo, compared through the stub's whole log"
    requirement: MCP-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#The plugin root variable in args reaches the server as the plugin's directory"
        status: pass
    human_judgment: false
  - id: D5
    description: "The stdio server's own environment holds CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA as Claude Code sets them (MENV-01/02)"
    requirement: MCP-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A stdio server's environment holds the plugin's root and data directories as Claude Code sets them"
        status: pass
    human_judgment: false
  - id: D6
    description: "Under the auth: oauth entry of D-08-04 (X-Team: core, no Authorization), the server receives X-Team on every request, no OAuth discovery request arrives, and the call is answered"
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#Under the OAuth entry of D-08-04, a remote server whose headers hold no Authorization key connects with no sign-in"
        status: pass
    human_judgment: false
  - id: D7
    description: "A header ${PI_CM_UNSET_TEAM} unset at install and at connect reaches the server as an empty x-team value (documented Pi gap)"
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A header whose variable is unset when the server connects reaches it empty, a documented Pi gap where Claude Code keeps the literal"
        status: pass
    human_judgment: false

duration: 51min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 02: MCP server configuration variants Summary

**A loopback Streamable HTTP stand-in shows that pi-mcp-adapter 7.0.0 sends a plugin's headers on every request, with `${VAR}` expanded at connect time. A Node `--import` preload shows that the stdio stub gets `env`, `args`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${VAR:-default}` as Claude Code expands them. No product file changed.**

## Performance

- **Duration:** about 51 min
- **Started:** 2026-11-01T15:16Z
- **Completed:** 2026-11-01T16:07Z
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments

- `features/mcp-server/configuration.feature` (`Feature: MCP server configuration`) has 10 scenarios, and every expected value is a whole literal:
  - the HTTP headers tracer;
  - an Outline of four `env` values;
  - a `${VAR}` set when Pi starts;
  - `${CLAUDE_PLUGIN_ROOT}` in `args`;
  - the injected stdio environment;
  - OAuth beside a header that is not `Authorization` (D-08-04);
  - a header whose variable is unset (Pi gap).
- `features/lib/mcp-server-http.ts`: a stand-in that listens on `127.0.0.1` port 0 only. It answers from a table keyed by JSON-RPC method, answers a notification with `202` and any other HTTP method with `405`. It logs each request, in arrival order, to `<harness>/mcp-server-http-requests.jsonl`, and closes in the scenario's release.
- `features/lib/mcp-server-environment.ts`: a preload that sets `STUB_TAG` from the variables named in `STUB_TAG_FROM`, so the frozen stub's echo shows its own environment. The frozen stub still starts as itself.

## Task Commits

1. **Task 1 (tracer): a loopback remote server receives the plugin's headers**: `f0ea905`
2. **Task 2: how env, args, and paths reach a stdio server**: `3d488d0`
3. **Task 3: OAuth beside headers and an unset header variable**: `26de41d`

The tracer gate re-ran Task 1's verify three times before expansion (seeds 266519, 332699, 915666).

## Step texts added

- Given `the published plugin {string} of the marketplace {string} has the http mcp server {string} with these headers:` (`| header | value |`)
- Given `the published plugin {string} of the marketplace {string} has the stub mcp server {string} that echoes its {string} and {string} environment variables`
- Given `pi-mcp-adapter has listed the tools of the http mcp server {string}`
- Then `the http mcp server {string} receives these json-rpc requests:` (`request` column, then one column per named header; POSTs in arrival order)
- Then `the http mcp server {string} receives these other requests in any order:` (the same columns; every non-POST request)

## Measured literals (pi-mcp-adapter 7.0.0, MCP SDK client 2.3.1, Pi 1.4.0) for the FG-30 rows of plan 06-08

**Remote server, `type: "http"`, headers `Authorization: Bearer t0k3n` and `X-Team: ${PI_CM_TEAM}`, `PI_CM_TEAM` unset at install and `core` at start:**

- POSTs, in this order: `initialize`, `notifications/initialized`, `tools/list` (the startup listing), then `initialize`, `notifications/initialized`, `tools/list`, `tools/call` (the call).
- Each POST carries `authorization: Bearer t0k3n` and `x-team: core`.
- `mcp-protocol-version: 2025-11-25` is on every request except `initialize`.
- After each `202` to `notifications/initialized`, a `GET` with `accept: text/event-stream` and the same headers. The stand-in answers it `405`.
- No `DELETE`, because the stand-in gives no `mcp-session-id`, and the adapter never calls `terminateSession`. The sockets are keep-alive and stay open until the release.
- The call returns `mcp returned: echo:ping`. The tool is `mcp__plugin_demo_web__echo`.
- `initialize` params: `protocolVersion: "2025-11-25"`, `clientInfo.name: "pi-mcp-plugin_demo_web_"`.
- Other headers on every request: `connection: keep-alive`, `content-type: application/json` and `accept: application/json, text/event-stream` (POST), `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: undici`, and `accept-encoding: gzip, deflate`. They are not pinned.

**OAuth beside headers (D-08-04), header `X-Team: core` only, so the install writes `auth: "oauth"`:**

- The same request sequence, each with `x-team: core` and no `authorization`.
- No OAuth discovery request (no `/.well-known/...`), and no sign-in. The call returns `mcp returned: echo:ping`.
- This confirms research assumption A3: with no `401` from the server, no OAuth flow runs. The row "pi-mcp-adapter turns OAuth off for every server with headers, unless the entry sets `auth: "oauth"`" holds, and the OAuth entry does not block the headers.

**Header variable unset at install and at connect (`Authorization: Bearer t0k3n`, `X-Team: ${PI_CM_UNSET_TEAM}`):**

- Every request carries `x-team` with the empty value `""` (present, not absent), and `authorization: Bearer t0k3n`. The call returns `mcp returned: echo:ping`.
- This holds the Variables divergence "A kept `${NAME}` that is not set when pi-mcp-adapter starts the server becomes an empty value".

**stdio (`STUB_TAG` echo through the frozen stub):**

| `STUB_TAG` in the plugin's `env`                     | Echo the model receives                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `literal`                                            | `literal:echo:ping`                                                                |
| `${CLAUDE_PLUGIN_DATA}`                              | `{agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping`                   |
| `${CLAUDE_PLUGIN_ROOT}`                              | `{home}/marketplaces/fixtures/plugins/demo:echo:ping`                              |
| `${PI_CM_STUB_TAG:-install-default}`, variable unset | `install-default:echo:ping`                                                        |
| `${PI_CM_STUB_TAG}`, `late` set when Pi starts       | `late:echo:ping`                                                                   |
| (preload) `CLAUDE_PLUGIN_ROOT,CLAUDE_PLUGIN_DATA`    | `{home}/marketplaces/fixtures/plugins/demo,{agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping` |

- With `args: [stub, "${CLAUDE_PLUGIN_ROOT}", "root"]`, the stub logs `{home}/marketplaces/fixtures/plugins/demo` as its plugin. The log holds both startup connections and `tools/call` with `_meta: {"pi-mcp-adapter/toolCallId": "{tool call 1}", "progressToken": 2}`.
- `node --import <file URL> <stub>` works in the adapter's stdio child. The fixture's `args` holds the preload as a `file://` URL, and the bridge copies it unchanged.

## Files Created/Modified

- `features/mcp-server/configuration.feature`: the MCP-03 configuration scenarios
- `features/step_definitions/mcp-server/configuration.steps.ts`: the http server Given, wait, and Thens, and the environment-echo Given
- `features/lib/mcp-server-http.ts`: the loopback Streamable HTTP MCP stand-in and `readMcpHttpRequests`
- `features/lib/mcp-server-environment.ts`: the `--import` preload (`MCP_SERVER_ENVIRONMENT_PRELOAD`)

## Decisions Made

- The listing wait ends at the first logged `tools/list`. The plan offered a DELETE or "every socket closed". Measurement shows neither happens: no DELETE, and the keep-alive sockets stay open across the listing and the turn until the release.
- The request log is stated in two whole partitions. The plan's fallback names this split if the GET races, and measurement shows that it does: the GET arrived within 1 ms of the concurrent `POST tools/list` (same socket set).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A lone server named `stub` reads as a stub marker**
- **Found during:** Task 2
- **Issue:** In 06-01's `withStubServers`, an object whose only member is `stub` is a stub marker. So the plan's doc string `{"mcpServers": {"stub": {"stub": {...}}}}` makes `mcpServers` itself the marker, and the step fails with `the stub marker of "mcpServers" takes only ...`. The same happened to the environment Given, which first wrote through `publishStubServersFile`.
- **Fix:** The doc-string scenarios name their servers `tag` (the env Outline and the `${VAR}` scenario) and `root` (the args scenario). This plan's own Givens write `.mcp.json` through the frozen `writePublishedPluginFile`, which expands no marker. `mcp-server-files.ts` (06-01's file) is unchanged.
- **Files modified:** `features/mcp-server/configuration.feature`, `features/step_definitions/mcp-server/configuration.steps.ts`
- **Commit:** `3d488d0`

**2. [Rule 1 - Bug] An empty header value and a missing header read the same**
- **Found during:** Task 3
- **Issue:** The plan's cell rule ("each named header's whole value or an empty cell") shows the measured empty `x-team: ""` exactly as a dropped header. So a wrong implementation that drops the header would still pass the unset-variable pin.
- **Fix:** A header that the request did not carry shows as `(none)`. The Task 1 and Task 3 tables state `(none)` for `mcp-protocol-version` on `initialize` and for `authorization` in the OAuth case.
- **Files modified:** `features/step_definitions/mcp-server/configuration.steps.ts`, `features/mcp-server/configuration.feature`
- **Commit:** `26de41d`

**3. [Rule 3 - Blocking] fallow found clone groups with the frozen stub**
- **Found during:** Task 1
- **Issue:** The first log reader mirrored `readStubRequests`, and the message type with `isRecord` mirrored the stub's prologue. That gave 2 clone groups, 126 lines.
- **Fix:** The reader goes through the frozen `readLogLinesSince` of `turn-records.ts`, and the message type is gone. `npx fallow dupes` now reports no clone group.
- **Commit:** `f0ea905`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug).
**Impact on plan:** All scenarios the plan named exist and pass. The two server names and the `(none)` cell differ from the plan text. No product file changed.

## Issues Encountered

- No red proof applies: no product file changed, and the scenarios pin existing adapter 7.0.0 behavior. `git diff --stat 38f3900..HEAD -- extensions` prints nothing.
- No "Handed-over fix": the OAuth case connects.
- The first lone `npm run lint` warm-up was killed for memory while other executors ran. ESLint on the plan's files passed, and the later `npm run check:static` runs passed in full: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features.
- `requirements.mark-complete` was not run from the worktree. The orchestrator marks MCP-03 after the merge.

## Verification

- `npx cucumber-js features/mcp-server/configuration.feature` (10 scenarios, 127 steps) passed three runs in a row after Task 3 (seeds 778094, 27847, 582451). It passed three runs after Task 2 (36463, 906881, 18493) and after Task 1 (266519, 332699, 915666).
- `npx cucumber-js features/mcp-server` (19 scenarios) passed (seed 146116).
- `npm run check:static` passed after each task. `npx fallow dupes --fail-on-issues` reports no clone group.
- Acceptance greps: `Feature: MCP server configuration` 1; `"127.0.0.1"` present and no wildcard bind; `onRelease(` 1; `Scenario Outline: A server` 1 with 4 Examples rows including `${CLAUDE_PLUGIN_DATA}`; `{home}/marketplaces/fixtures/plugins/demo` 4; `STUB_TAG_FROM` 3; `D-08-04` 1.

## Next Phase Readiness

- Plan 06-08 can cite the literals above for the variable, header, and OAuth rows of `docs/mcp-compatibility.md`.
- A later plan that needs a remote server can reuse `McpHttpServer` and the two request Thens.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The stand-in binds `127.0.0.1` port 0 only (T-06-04). The release closes it after the profile Pi stops (T-06-06). It logs only fixture header values into the per-scenario sandbox (T-06-05). It uses `node:http` only and installs no package (T-06-SC).

## Parent lines

- `features/lib/mcp-server-files.ts` (06-01): `withStubServers` reads a `{"mcpServers": {"stub": {...}}}` document as a marker for `mcpServers`. A plugin whose only server is named `stub` cannot be written through the shared stub-servers Given. Either document this in the file overview and the cucumber layout notes, or limit marker matching to members of a server map. This plan works around it with the names `tag` and `root`.
- `features/lib/mcp-server-files.ts`: this plan imports none of the `/** @public */` writers. Its Givens use the frozen `writePublishedPluginFile`, and its doc strings go through the shared Given. The tag clean-up that 06-01 recorded is unchanged by this plan.
- `docs/mcp-compatibility.md` (owned by the docs plan): under "Translated fields", the `type: "http"` row could say that the MCP SDK client opens an optional event stream with a `GET` after `notifications/initialized`, and that a server may answer it `405`. The research FG-30 row already plans the SSE fallback note (`404`/`405`/`406`/`415` on a POST).
- Phase 6 log (the orchestrator appends): the Dubious Choices below.

## Self-Check: PASSED

- FOUND: features/mcp-server/configuration.feature, features/step_definitions/mcp-server/configuration.steps.ts, features/lib/mcp-server-http.ts, features/lib/mcp-server-environment.ts
- FOUND commits on this branch: f0ea905, 3d488d0, 26de41d (3 commits, measured `git rev-list --count 38f3900..HEAD` before this SUMMARY)
- Acceptance criteria of all three tasks re-run: all PASS
- Plan verification: 3 consecutive green runs of the feature file; `npm run check:static` and `npx fallow dupes` passed

## Dubious Choices

1. **POSTs in arrival order, other requests in any order.** Alternatives:
   - Answer `notifications/initialized` with `200` instead of `202`, so that the SDK opens no GET. The spec says `202`.
   - Compare the whole log as one unordered set, which loses the order of the JSON-RPC requests.

   Dubious because a GET that comes at the wrong time, or too many GETs, shows only in the count of the second table.
2. **The HTTP listing wait ends at the first logged `tools/list`.** Alternatives:
   - Wait for the sockets to close, which happens only at the release.
   - Answer with `Connection: close`, which says nothing about the adapter's client close.
   - Wait for the adapter's metadata cache file.

   Dubious because a short gap remains between the `tools/list` answer and the adapter's `manager.close`. A turn that started within that gap could reuse the listing connection. That did not happen in 15 runs.
3. **`(none)` for a missing header**, against the plan's "empty cell". Alternative: keep empty cells and give the unset-variable scenario a separate presence column. Dubious because it changes the cell vocabulary that the plan text fixed.
4. **The OAuth scenario cannot tell OAuth mode from non-OAuth mode.** The server receives the same requests either way, apart from header order. The scenario pins that the `auth: "oauth"` entry still connects, sends the header, and starts no sign-in. The integration test `mcp-adapter-entry-conformance.test.ts` pins that the install writes the field. The title names D-08-04 so the scenario says what it covers. Alternative: arm the stand-in with `401` to show that OAuth starts, but remote OAuth end to end is out of scope (RM-01..05). Dubious because a regression that dropped `auth: "oauth"` would still pass this scenario.
5. **Server names `tag` and `root` in the doc-string scenarios** in place of the plan's `stub`, because of the 06-01 marker rule (parent line above). Alternative: edit `withStubServers`, a file that 06-01 owns. Dubious because the tool names differ from the plan's `mcp__plugin_demo_stub__echo` in those scenarios.
6. **The preload goes into `args` as a `file://` URL (`import.meta.url`)**, not as a path. Alternative: `fileURLToPath`. A path works with `--import` on POSIX, but the URL form is portable. Dubious only because the fixture's `args` then holds a URL that the bridge copies unchanged.
7. **The stand-in's answers differ slightly from the stub's.** The `initialize` result echoes the client's `protocolVersion` with no fallback, and the `echo` input schema has no `required` list. This keeps fallow from reporting a clone of `mcp-stub-server.ts`. Dubious because the two stand-ins are not byte-for-byte mirrors.
