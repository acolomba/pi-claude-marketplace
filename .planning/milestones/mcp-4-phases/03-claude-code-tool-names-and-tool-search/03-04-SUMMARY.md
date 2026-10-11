---
phase: 03-claude-code-tool-names-and-tool-search
plan: 04
subsystem: mcp-resolver
tags: [resolver, partial-install, closed-catalog, mcp, typebox]

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-03 translateMcpServer and the closed Claude Code 2.1.291 server table in domain/mcp-server-features.ts"
provides:
  - "classifyMcpServer(server): supported | blocked (McpUnsupportedFeature) | malformed (detail), with Claude Code 2.1.291's stdio, remote and ws schemas compiled once with typebox"
  - "McpResolution.unsupported and McpResolution.droppedMcpServers; MaterializableFields.droppedMcpServers ({ server, feature }) with two-way drift checks"
  - "Closed-set Reason member `unsupported mcp` (66 members), mapped from the typed `mcpServers` kind"
  - "Resolver note prefix `malformed mcp server \"<name>\": ` classified to `malformed mcp` on the install and read-only surfaces"
  - "Catalog states failure-unsupported-mcp and partially-installed-inventory-mcp with byte-pinned fixtures"
affects: [03-05, 03-06, 03-07, 03-09]

actuals:
  tokens: 20769
  tasks: 3
  commits: 1
plan_head_before: fa15430348b47e0520faefbcf14bbf26d7970c94
plan_head_after: a623ffab8e4efa864deb44efd62223ebf04b9872

tech-stack:
  added: []
  patterns:
    - "A server verdict is a discriminated union; the resolver folds blocked servers into the typed `mcpServers` kind and malformed ones into structural notes"
    - "Per-transport typebox schemas are compiled once; `Check` narrows the server to its static type, so the feature checks read typed fields"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - docs/output-catalog.md

key-decisions:
  - "A non-object server gives the detail `(root): must be object`; an unknown type gives `unknown type <JSON value>`; every other malformed detail is typebox's first error as `<instancePath or (root)>: <message>`"
  - "alwaysLoad, bareElicitationCapability and discoveryCache must be booleans and tools[].name a string, as Claude's schema requires; role and request_timeout_ms stay unvalidated and oauth.xaa accepts any value"
  - "Remote-only fields (headersHelper, tools, toolPermissions) are not features on a stdio server, because Claude's strip-mode stdio schema drops them"
  - "The supported servers are rebuilt with Object.fromEntries so a server named __proto__ stays an own server"

patterns-established:
  - "A typed kind that renders an aggregate reason (`hooks`, `mcpServers`) carries no resolver note; the per-item breakdown rides a typed field on the materializable arm"

requirements-completed: [ANAME-03, ANAME-07]

coverage:
  - id: D1
    description: "classifyMcpServer blocks the ten D-03-10/D-03-20 features in table order and makes every schema-invalid config malformed; role and discoveryCache never block"
    requirement: ANAME-07
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: headersHelper wins over bareElicitationCapability in table order"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: a callbackPort above 65535 is malformed"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: role and discoveryCache never block a server"
        status: pass
    human_judgment: false
  - id: D2
    description: "A normal install of a plugin with a ws server refuses before any write with (partially-available) {unsupported mcp} and the --partial hint"
    requirement: ANAME-07
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-07: a normal install of a plugin with a ws server refuses with {unsupported mcp} and the --partial hint"
        status: pass
    human_judgment: false
  - id: D3
    description: "--partial writes every server except the blocked one; the record lists only written servers, compatibility.unsupported holds mcpServers, and the row is (partially-installed) {unsupported mcp}"
    requirement: ANAME-07
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-07: --partial installs every server except the blocked one"
        status: pass
      - kind: unit
        ref: "tests/domain/plugin-resolver.test.ts#ANAME-07: a ws server makes the plugin partially available with the server left out"
        status: pass
    human_judgment: false
  - id: D4
    description: "A server config Claude Code's schema rejects makes the plugin unavailable with {malformed mcp}, and it wins over a blocked server"
    requirement: ANAME-07
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-07: a server Claude Code's schema rejects makes the plugin unavailable with {malformed mcp}"
        status: pass
      - kind: unit
        ref: "tests/domain/plugin-resolver.test.ts#ANAME-07: a malformed server wins over a blocked one and makes the plugin unavailable"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-surface-reason-parity.test.ts#keeps the install and read-only note surfaces equal for malformed mcp: malformed mcp server \"lspServers\": /timeout: must be integer"
        status: pass
    human_judgment: false
  - id: D5
    description: "No tool-name length check: a 40-character plugin with an 80-character server installs normally"
    requirement: ANAME-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#ANAME-03: a plugin tool-name prefix past 128 characters installs with no length check"
        status: pass
    human_judgment: false
  - id: D6
    description: "Reason gains exactly `unsupported mcp`, and the output catalog documents it with two byte-pinned states"
    requirement: ANAME-07
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 66-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 21 fixture modules to 264 exact documented states"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-10-06
status: complete
---

# Phase 3 Plan 04: {unsupported mcp} partial install and malformed server configs Summary

**`classifyMcpServer` checks every declared server against Claude Code 2.1.291's stdio, remote and ws schemas, compiled once with typebox. A server that needs a feature pi-mcp-adapter cannot honor (`ws`, a host-only type, `headersHelper`, a truthy `oauth.xaa`, a per-tool `permission_policy`, a non-empty `toolPermissions`, `bareElicitationCapability: true`) makes the plugin `partially-available` with one `{unsupported mcp}` reason. A normal install refuses with the `--partial` hint, and `--partial` leaves each such server out whole. A config Claude's schema rejects makes the plugin `unavailable` with `{malformed mcp}`. No tool-name length check exists.**

## Performance

- **Duration:** about 23 min
- **Started:** 2026-10-06T17:46:54Z
- **Completed:** 2026-10-06T18:10:06Z
- **Tasks:** 3
- **Files modified:** 24 (0 created)

## Accomplishments

- `domain/mcp-server-features.ts`: `McpUnsupportedFeature`, `DroppedMcpServer`, `McpServerVerdict` and `classifyMcpServer`. The order is: a non-object is malformed; a host-only type is blocked without validation; `stdio` (or no type), `sse`/`http`/`streamable-http` and `ws` are validated by their compiled schema; an unknown type is malformed. A valid `ws` server is blocked by `ws`. A valid remote server is blocked by its first feature in table order. Any valid server with `bareElicitationCapability: true` is blocked.
- `domain/mcp-resolution.ts`: `recordMcpServers` keeps the supported servers in declared order, records each blocked server as `{ server, feature }`, pushes the kind `mcpServers` into `unsupported` once, and adds no note for it. A malformed server pushes `malformed mcp server "<name>": <detail>` and reports a structural defect, so the existing `dirty` path makes the plugin `unavailable` (D-64-07 precedence).
- `domain/resolver-types.ts` and `plugin-resolver.ts`: `droppedMcpServers` is an optional member of the materializable arm, with a type-only `DroppedMcpServerSchema` and drift checks in both directions, and `materializableFields` spreads it.
- `shared/probe-classifiers.ts`, `shared/notification-types.ts`, `shared/notify-reasons.ts`: the `unsupported mcp` reason, the `mcpServers` -> `unsupported mcp` arm, and the `malformed mcp server ` note arm before the `lspServers` substring arm. `install.messaging.ts` has the same note arm before its `includes("source")` arm.
- `docs/output-catalog.md`: the status table, the Reasons paragraph (the stale `46-member` tuple sentence is replaced by the `Reason` union and its two gates, without a count), the new install state `failure-unsupported-mcp`, the new list state `partially-installed-inventory-mcp`, and the `unavailable-single-scope` prose.

## Task Commits

The plan commits once, as Task 3 directs:

1. **Task 1: ws refusal end to end (tracer)** - `a623ffab` (feat). Tracer gate: Task 1's verify (typecheck, the closed-set and vocabulary gates, the `^ANAME-07` install-flow run) was re-run and passed before expansion.
2. **Task 2: malformed server configs on both surfaces (TDD)** - `a623ffab` (feat)
3. **Task 3: --partial, no length check, catalog amendment** - `a623ffab` (feat)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

## Verification

- Task 1: `npm run typecheck` clean; `notify-closed-set-locks`, `compat-01-no-expansion` and `partial-vocabulary-guard` passed 61 of 61; `^ANAME-07` install-flow run passed 2 of 2.
- Task 2: the five owner tests passed 214 of 214; `^ANAME-07` install-flow run passed 3 of 3; `npm run test:coverage:direct` for `mcp-server-features.ts`, `mcp-resolution.ts`, `probe-classifiers.ts` and `install.messaging.ts` exit 0.
- Task 3: `TMPDIR=/var/tmp/mcp4-p3-04 npm run test:modules` exit 0 (8309 tests); `npm run test:architecture` exit 0; `npm run test:integration` exit 0.
- `PRECOMMIT_EXIT=0` (last line of `tmp/p3-04-precommit.log`, after one mdformat pass reflowed `docs/output-catalog.md`).
- `npx fallow audit --base fa154303`: no issues in the 24 changed files; 3 inherited clone groups excluded.
- Commit hook: `npm run check:commit` passed for `a623ffab` (Node v26.10.0).
- The decision-ID check (`git diff fa154303 -- extensions tests | rg '^\+' | rg -c 'D-0[3]-[0-9]{2}'`) printed nothing.
- Focused task verification passed; full phase/PR verification pending (the wave gate runs `npm run check`).

## TDD Record (Task 2)

- RED: 37 `classifyMcpServer` rows were added before the schemas existed. The 14 malformed rows failed on their `deepStrictEqual` assertion (for example `a zero timeout is malformed` returned `{ kind: "supported" }`), and the blocked and supported rows passed against Task 1's code. Semantic assessment: the target cases ran and failed on the planned assertion, with no load or fixture fault.
- GREEN: the compiled schemas made all 73 rows of the file pass.
- The plan makes one commit, so there are no separate RED/GREEN commits.

## Local reason unions widened

None. The compiler named no local union: `list-flow.ts::ListReason` covers only the notes path and needed no change, and `install.messaging.ts` uses `ContentReason`, which derives from `Reason`. `list-flow.ts` is in `files_modified` but is unchanged.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-server-features.ts`: the classifier and the compiled schemas.
- `extensions/pi-claude-marketplace/domain/mcp-resolution.ts`: per-server classification.
- `extensions/pi-claude-marketplace/domain/{resolver-types,plugin-resolver}.ts`: `droppedMcpServers`.
- `extensions/pi-claude-marketplace/shared/{probe-classifiers,notification-types,notify-reasons}.ts` and `orchestrators/plugin/install.messaging.ts`: the reason and the note arms.
- `docs/output-catalog.md` and `tests/architecture/catalog-uat/fixtures/{plugin-install,plugin-list}.ts`: the catalog amendment.
- Tests: `tests/domain/{mcp-server-features,mcp-resolution,plugin-resolver}.test.ts`, `tests/shared/{probe-classifiers,notification-types}.test.ts`, `tests/orchestrators/plugin/{install-flow,install.messaging,enable-disable.messaging}.test.ts`, `tests/architecture/{notify-closed-set-locks,compat-01-no-expansion,cross-surface-reason-parity}.test.ts`, `tests/architecture/catalog-uat/{catalog-contract,catalog-parser}.test.ts`.

## Decisions Made

- The malformed detail format follows the plugin.json precedent (`<instancePath or (root)>: <message>`), so the notes read `malformed mcp server "db": /timeout: must be integer`.
- The schemas validate every typed field the plan's `<interfaces>` lists, including the booleans `alwaysLoad`, `bareElicitationCapability` and `discoveryCache`. A non-boolean `alwaysLoad` is therefore malformed. No existing fixture used one.
- Remote-only fields on a stdio server are ignored, as Claude's strip-mode schema ignores them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A third Reason enumeration needed the new member**
- **Found during:** Task 1
- **Issue:** `tests/shared/notification-types.test.ts` holds its own `EXPECTED_REASONS` with an `IsExact` proof, so the build failed after `Reason` grew.
- **Fix:** Appended `unsupported mcp` to that list.
- **Files modified:** tests/shared/notification-types.test.ts
- **Committed in:** a623ffab

**2. [Rule 3 - Blocking] Catalog gate count and byte pins**
- **Found during:** Task 3 (`npm run test:architecture`)
- **Issue:** `catalog-contract.test.ts` and `catalog-parser.test.ts` pin the documented state count (262) and the total fenced-block bytes (40000).
- **Fix:** Moved the pins to 264 states and 40287 bytes, the two new states' exact contribution.
- **Files modified:** tests/architecture/catalog-uat/catalog-contract.test.ts, tests/architecture/catalog-uat/catalog-parser.test.ts
- **Committed in:** a623ffab

**3. [Rule 1 - Bug] A test used `mcpServers` as an arbitrary unsupported kind**
- **Found during:** Task 3 (`npm run test:modules`)
- **Issue:** `enable-disable.messaging.test.ts` "staleGateDropped preserves first-seen unsupported-kind order and deduplicates reasons" expected `mcpServers` to collapse to `unsupported component`. It now maps to `unsupported mcp`.
- **Fix:** The expectation lists `unsupported mcp` in first-seen order; the case still proves ordering and dedup.
- **Files modified:** tests/orchestrators/plugin/enable-disable.messaging.test.ts
- **Committed in:** a623ffab

**4. [Rule 1 - Bug] The translator test file gained a second entrypoint**
- **Found during:** Task 2
- **Issue:** The unit-testing rules require one top-level `describe()` per exported entrypoint once a module has several.
- **Fix:** The existing translator rows moved under `describe("translateMcpServer")`, and the classifier rows sit under `describe("classifyMcpServer")`. Titles are unchanged.
- **Files modified:** tests/domain/mcp-server-features.test.ts
- **Committed in:** a623ffab

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 test fixes). **Impact on plan:** none on scope; each change follows from the new reason or the new verdict.

## Issues Encountered

- ESLint `no-extra-boolean-cast` rejected `Boolean(server.oauth?.xaa)` in an `if`; the condition now reads the value directly.
- The info severity is delivered as `undefined` to `ctx.ui.notify`, so the new install-flow cases assert `severity: undefined` for the info rows.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-10 and T-03-11 are mitigated as planned: the classifier rows and the refusal and `--partial` e2e cases assert that a blocked feature never reaches `mcp-adapter.json` without `--partial`, and that a schema-invalid config makes the plugin unavailable.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 03-06 can render `info`'s per-server breakdown from `resolved.droppedMcpServers` (`{ server, feature }`); `mcpServers` on the materializable arm already holds only the supported servers.
- Plan 03-09 documents the divergence that this extension makes the whole plugin unavailable for one schema-invalid server, where Claude Code skips only that server.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/mcp-server-features.ts (classifyMcpServer export, Compile schemas)
- FOUND: docs/output-catalog.md (both catalog states)
- FOUND: commit a623ffab on HEAD
- All acceptance criteria of the three tasks re-run and passing after the commit, and the decision-ID check printed nothing.

---
*Phase: 03-claude-code-tool-names-and-tool-search*
*Completed: 2026-10-06*
