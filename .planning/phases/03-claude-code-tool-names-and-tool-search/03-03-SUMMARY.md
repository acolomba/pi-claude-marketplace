---
phase: 03-claude-code-tool-names-and-tool-search
plan: 03
subsystem: mcp-bridge
tags: [mcp-bridge, translation, adapter-entry, description, security, pi-mcp-adapter]

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-01 generatedMcpServerKey, owned directTools/toolPrefix on every stamped entry"
provides:
  - "translateMcpServer(server, description) in domain/mcp-server-features.ts: the closed Claude Code 2.1.291 server table shared by the resolver and the MCP bridge"
  - "MaterializableFields.description: plugin.json description first, marketplace entry second, absent when neither is a non-empty string"
  - "StageMcpInput.description and StampServersInput.description, fed by install, update and reinstall"
  - "Vendored OAUTH_CONFIG_KEYS (pi-mcp-adapter 5.0.0 OAuthConfig) beside SERVER_ENTRY_KEYS in tests/bridges/mcp/adapter-entry.test.ts"
affects: [03-04, 03-05, 03-08, phase-5-entry-migration]

actuals:
  tokens: 16966
  tasks: 3
  commits: 1
plan_head_before: 8be3dd777d1d80871a1eb5dcc646f68990a42d5f
plan_head_after: 94775201f953def72e4d993339142ceb0ee988b9

tech-stack:
  added: []
  patterns:
    - "Closed allow-list translation: one small function per transport family, one for oauth, one for the timeout; a value is copied only when it has the named type"
    - "Plugin metadata (defaultEnabled, description) travels as one PluginMetadata object from preflight to the materializable arm constructors"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - tests/domain/mcp-server-features.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts

key-decisions:
  - "A server with no type is a stdio server: a url-only entry without type keeps only the owned fields, as the closed table directs"
  - "args, env and headers are copied when they are an array or a plain object; their element types are not checked (the table names only the container type)"
  - "The resolver's defaultEnabled parameter became a PluginMetadata object so description travels with it without a fifth positional parameter"
  - "The ANAME-04 alwaysLoad rows moved from adapter-entry.test.ts to the translator's owner test, mcp-server-features.test.ts"

patterns-established:
  - "translateMcpServer output key order: transport fields, oauth, requestTimeoutMs, description, directTools, toolPrefix; stampServers then appends carried fields and the marker"

requirements-completed: [ANAME-04, ANAME-05, ANAME-06, ANAME-07]

coverage:
  - id: D1
    description: "The closed table maps stdio, sse, http and streamable-http fields, the timeout and request_timeout_ms rules, and the four OAuth keys; an unknown type and wrongly typed values map nothing"
    requirement: ANAME-07
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: a timeout of 3000000000 is capped at 2147483647"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: an http request_timeout_ms of 300001 folds in as 300000"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: writes fields in the order transport, oauth, timeout, description, owned"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin entry holding every ServerEntry and OAuthConfig key at hostile values keeps only the closed table's fields (T-03-06, T-03-07, T-03-08)"
    requirement: ANAME-07
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#ANAME-07: a plugin entry holding every ServerEntry and OAuthConfig key at hostile values keeps only the closed table's fields"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-07: install writes Claude servers through the closed adapter table"
        status: pass
    human_judgment: false
  - id: D3
    description: "No entry written from plugin input holds lifecycle; a carried user lifecycle still carries"
    requirement: ANAME-05
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-05: a stdio server keeps command, args and env and drops lifecycle"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06: the previous disabled and lifecycle carry onto the new entry"
        status: pass
    human_judgment: false
  - id: D4
    description: "directTools is true only for alwaysLoad: true and toolPrefix is mcp, now written by the translator"
    requirement: ANAME-04
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-04: alwaysLoad \"true\" gives directTools \"search\""
        status: pass
    human_judgment: false
  - id: D5
    description: "Every entry carries the plugin.json description, falling back to the marketplace entry's, on install, update and reinstall"
    requirement: ANAME-06
    verification:
      - kind: unit
        ref: "tests/domain/plugin-resolver.test.ts#ANAME-06: the plugin.json description wins over the entry's"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-06: the marketplace entry's description is the fallback"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/update-flow.test.ts#ANAME-06: update writes the new version's description and timeout"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-06
status: complete
---

# Phase 3 Plan 03: Closed Claude Code server table Summary

**Plugin MCP entries are now built by `translateMcpServer`, a closed Claude Code 2.1.291 table in `domain/mcp-server-features.ts`: stdio `command`/`args`/`env`, remote `url`/`headers` with `sse` as `httpTransport`, `timeout` or `request_timeout_ms` as `requestTimeoutMs`, four OAuth keys with `callbackPort` as `http://localhost:<port>/callback`, and the plugin's description. Every other key, including `auth`, `bearerTokenEnv`, `approveTools`, `requestHeadersCommand`, `inheritEnv`, `cwd` and `lifecycle`, is dropped.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-10-06T17:25:47Z
- **Completed:** 2026-10-06T17:45:00Z
- **Tasks:** 3
- **Files modified:** 17 (2 created)

## Accomplishments

- `translateMcpServer(server, description)` implements the plan's table exactly. Values are copied only when they have the named type, so the function is total over `unknown`. A `timeout` below 1000 or not an integer writes nothing and does not fold. `timeout` is capped at 2147483647. `request_timeout_ms` folds in only on remote types when `timeout` is absent, capped at 300000. `oauth` is written only when one of `clientId`, `callbackPort` (integer 1..65535), `authServerMetadataUrl` (https only) or `scopes` (non-empty) maps.
- `adapter-entry.ts`: `translatedEntry` now returns `translateMcpServer(substituteAndInject(...), description)`. The non-object warning and the malformed stdio env warning stay. The owned-field code from 03-01 (`withOwnedFields`, `OWNED_FIELD_SET`) is gone because the translator owns those fields.
- The resolver resolves `description` once in preflight beside `defaultEnabled`: `plugin.json` first, then the marketplace entry, and absent when neither is a non-empty string. The `unavailable` arm never carries it.
- `install-outcome.ts`, `update-swap.ts` and `reinstall-replace.ts` pass `description` from the resolved arm with no conditional.
- The hostile-input security test covers every pi-mcp-adapter 5.0.0 `ServerEntry` key and every `OAuthConfig` key, with the plan's hostile values. It compares the whole entry and finds only the table's fields, the owned fields and the marker.

## Task Commits

The plan commits once, as Task 3 directs:

1. **Task 1: closed adapter entries end to end (tracer)** - `94775201` (feat). The tracer gate re-ran Task 1's verify (typecheck, domain test, pattern-filtered install-flow run with `ANAME-07: install writes Claude servers through the closed adapter table` passing) before expansion.
2. **Task 2: description on every entry (TDD)** - `94775201` (feat).
3. **Task 3: complete table, hostile-input test, update, remaining suites** - `94775201` (feat).

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

## Verification

- Task 1: `npm run typecheck` clean. `node --test tests/domain/mcp-server-features.test.ts` passed 38 of 38. The pattern-filtered install-flow run passed 23 of 23.
- Task 2: `node --test tests/domain/plugin-resolver.test.ts` passed 176 of 176. The `^ANAME-0` install-flow run passed 4 of 4. `npm run test:coverage:direct -- .../domain/plugin-resolver.ts` exit 0.
- Task 3: `TMPDIR=/var/tmp/mcp4-p3-03 npm run test:modules` exit 0. `npm run test:integration` exit 0 after the fix below. `npm run test:unpaired` exit 0. `npm run test:coverage:direct` for `mcp-server-features.ts`, `adapter-entry.ts`, `stage.ts` and `plugin-resolver.ts` exit 0.
- `PRECOMMIT_EXIT=0` (last line of `tmp/p3-03-precommit.log`).
- `npx fallow audit --base 8be3dd77`: no issues in the 17 changed files. One inherited clone group in `plugin-resolver.ts` (lines 425-482, the existing unavailable-return blocks) was excluded as inherited.
- Commit hook: `npm run check:commit` passed for `94775201` (Node v26.10.0).
- The decision-ID check (`git diff 8be3dd77 -- extensions tests | rg '^\+' | rg -c 'D-0[3]-[0-9]{2}'`) printed nothing.
- Focused task verification passed; full phase/PR verification pending (the wave gate runs `npm run check`).

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-server-features.ts` (new): the closed table, `translateMcpServer`.
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`: wired to the translator; `StampServersInput.description`.
- `extensions/pi-claude-marketplace/bridges/mcp/{stage,types}.ts`: `StageMcpInput.description` passed to `stampServers`.
- `extensions/pi-claude-marketplace/domain/{plugin-resolver,resolver-types}.ts`: `resolveDescription`, `PluginMetadata`, `MaterializableFields.description`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install-outcome,update-swap,reinstall-replace}.ts`: one `description` property each.
- Tests: `tests/domain/mcp-server-features.test.ts` (new), `tests/domain/plugin-resolver.test.ts`, `tests/bridges/mcp/{adapter-entry,stage}.test.ts`, `tests/orchestrators/plugin/{install,update}-flow.test.ts`, `tests/architecture/integration-materialization-gate.test.ts`, `tests/integration/mcp-override-lifecycle.test.ts`.

Suites changed beyond `files_modified`: `tests/integration/mcp-override-lifecycle.test.ts`. Its case "AFILE-06: uninstall writes back no carried field the plugin's entry declares and the user's override lacks" relied on the plugin passing `lifecycle` and `debug` through. It now declares `timeout: 5000`, the one carried field a plugin entry can still set, and asserts `requestTimeoutMs: 5000` on install and its absence from the written-back override.

## Decisions Made

- A server with no `type` is a stdio server, as the table says. Fixtures that wrote url-only servers without a `type` (stage.test.ts, adapter-entry.test.ts) now say `type: "http"`.
- `args` must be an array and `env`/`headers` plain objects; element types are not checked. The table names only the container type, and plan 03-04 or Phase 4 can tighten it.
- The resolver's `defaultEnabled` positional parameter became a `PluginMetadata` object (`defaultEnabled`, `description`) across `materializableFields`, `installable`, `partiallyAvailable` and `decideResolution`.
- The adapter-entry ordering case now also pins that a carried `requestTimeoutMs` (9000) overrides the plugin's `timeout` (5000) and keeps the translated key position. Plan 03-08 changes that interaction (D-03-04) and will update this case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Integration case relied on plugin pass-through of carried fields**
- **Found during:** Task 3 (step 6, `npm run test:integration`)
- **Issue:** `tests/integration/mcp-override-lifecycle.test.ts` expected the plugin's `lifecycle: "eager"` and `debug: true` on the installed entry. The closed table drops both.
- **Fix:** The fixture declares `timeout: 5000` instead and asserts `requestTimeoutMs`, which keeps the case's claim: a carried field the plugin sets is not written back into the user's override.
- **Files modified:** tests/integration/mcp-override-lifecycle.test.ts
- **Verification:** `npm run test:integration` exit 0
- **Committed in:** 94775201

---

**Total deviations:** 1 auto-fixed (1 bug in a test fixture). The plan's step 6 anticipated this kind of fix.
**Impact on plan:** None on scope.

## TDD Note

Task 2's resolver code was written before its `ANAME-06` cases, so no RED run was recorded for those rows. The `unavailable`-arm case was first run with a placeholder note and failed on that note, which confirmed the arm shape. The plan makes one commit, so there are no separate RED/GREEN commits.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 03-04 can add the `{unsupported mcp}` classifier to `domain/mcp-server-features.ts` beside `translateMcpServer`. An unknown `type` (`ws`, host-only types) currently maps to the owned fields only, and 03-04 keeps such servers out of the bridge.
- Entries written before this change still hold plugin-set adapter-only keys until the plugin is restaged. A restage rewrites them through the table. A previous plugin entry's `lifecycle` or other carried field is still carried as if it were the user's until plan 03-08 (D-03-04/05) records which carried fields the plugin set.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/mcp-server-features.ts
- FOUND: tests/domain/mcp-server-features.test.ts
- FOUND: commit 94775201 on HEAD
- All acceptance criteria re-run and passing: `translateMcpServer` export (1 line) and call in `translatedEntry`; no `127.0.0.1` in the module; `ANAME-07: install writes Claude servers` case; `description` member in `resolver-types.ts`; one `description: ` call-site line in each of the three orchestrators; `ANAME-06` cases in both test files; one `types.ts:397-422 (OAuthConfig)` provenance line, in one file; `ANAME-06: update writes` case; `PRECOMMIT_EXIT=0`.

---
*Phase: 03-claude-code-tool-names-and-tool-search*
*Completed: 2026-10-06*
