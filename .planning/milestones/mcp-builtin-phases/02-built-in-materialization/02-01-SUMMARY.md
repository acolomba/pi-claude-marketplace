---
phase: 02-built-in-materialization
plan: "01"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, registration, cucumber, tool-search]
status: complete

requires:
  - phase: 01-foundation-and-pi-1-5-0
    provides: "frozen step signatures, profileFor(\"builtin\"), recordedMcpServers and createLegacyServersReader, PiMcpRegistry, the dual cucumber profiles"
provides:
  - "translateBuiltinMcpServer: the closed Claude-to-Pi built-in field table"
  - "McpFieldEncoder port in substitute.ts, ADAPTER_FIELD_ENCODER, BUILTIN_FIELD_ENCODER"
  - "builtinServerConfig, syncBuiltinRegistrations, readBuiltinServerDescription (bridge barrel)"
  - "filled builtinRegistrationStep and resyncBuiltinRegistrations bodies"
  - "the calls step 'the model receives these calls, with each tool search reduced to the tools it loads:'"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09]

actuals:
  tokens: 29100
  tasks: 3
  commits: 3
plan_head_before: 730f507b38082dd87c9f84b2c72d68195f63c0c3
plan_head_after: f7478b2d95432f85d14f25d5a666121baccea0fb

tech-stack:
  added: []
  patterns:
    - "Consumer-declared encoder port: one field walk, one encoder per MCP implementation"
    - "Idempotent registry sync keyed on JSON.stringify of each config"
    - "Per-record and per-scope failure isolation with name-only debug logs"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-description.ts
    - features/lib/mcp-builtin-tool-search.ts
    - features/step_definitions/mcp-server/builtin-tool-search.steps.ts
    - test/domain/mcp-builtin-translation.test.ts
    - test/bridges/mcp/builtin-escape.test.ts
    - test/bridges/mcp/builtin-entry.test.ts
    - test/bridges/mcp/builtin-registration.test.ts
    - test/bridges/mcp/builtin-description.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/index.ts
    - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
    - features/mcp-server/listing.feature
    - test/bridges/mcp/substitute.test.ts
    - test/bridges/mcp/index.test.ts
    - test/orchestrators/mcp/builtin-registration-step.test.ts

key-decisions:
  - "substituteAndInject keeps the adapter encoder as the default of its new encoder parameter, because the unowned, must-stay-unchanged test/integration/adapter-expansion-conformance.test.ts calls it with two arguments (P2-DC-19 reversed)"
  - "ADAPTER_FIELD_ENCODER lives in substitute.ts, built over adapter-escape.ts, which stays unchanged, because exporting it from adapter-escape.ts left serializeSegments and serializeLiteral with no production consumer (fallow unused-export)"
  - "The description reader is kept: npx fallow dupes reports no clone group (P2-DC-23, keep branch)"
  - "A record with an empty recorded server list returns before the description and data-directory reads"

patterns-established:
  - "Built-in registration: gate on snapshot.softDeps.mcpImplementation, then containment, recorded servers, classify, name, build, sync"

requirements-completed: [BLT-01, MSEL-03, BLT-02, BLT-04, MREC-02]

coverage:
  - id: D1
    description: "A recorded stdio server of an enabled user record registers with Pi's built-in MCP under plugin_<plugin>_<server> and its tool appears inactive until a search"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature (builtin profile, 3 scenarios)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/mcp/builtin-registration-step.test.ts"
        status: pass
  - id: D2
    description: "Under pi-mcp-adapter or no implementation, nothing registers"
    requirement: MSEL-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#Under pi-mcp-adapter the extension registers no server with Pi (MSEL-03)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/mcp/builtin-registration-step.test.ts#MSEL-03"
        status: pass
  - id: D3
    description: "Values resolved from the session environment and escaped for Pi's resolver; adapter output byte-identical"
    requirement: BLT-02
    verification:
      - kind: unit
        ref: "test/bridges/mcp/builtin-escape.test.ts, builtin-entry.test.ts, substitute.test.ts, test/domain/mcp-builtin-translation.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts, mcp-adapter-entry-conformance.test.ts (unchanged since 87d3f28)"
        status: pass
  - id: D4
    description: "Pi lists the server under Claude Code's name"
    requirement: BLT-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#Pi lists the plugin's server under Claude Code's name (BLT-04, D-MB-13)"
        status: pass
  - id: D5
    description: "A legacy record without mcpServerConfigs registers through the legacy reader; an unreadable one registers nothing"
    requirement: MREC-02
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/builtin-registration-step.test.ts#MREC-02"
        status: pass

duration: 2h 40m
completed: 2026-11-04
---

# Phase 2 Plan 01: Built-in MCP registration Summary

**Pi's built-in MCP now serves recorded plugin MCP servers: a field table derived from the adapter table, an encoder port in the shared walk, an idempotent sync over Pi's registry, and the filled session and resync steps, proven by `listing.feature` under both cucumber profiles.**

## Performance

- **Duration:** about 2 h 40 min
- **Completed:** 2026-11-04T13:50Z
- **Tasks:** 3 of 3
- **Files:** 20 changed (12 created, 8 modified)

## Accomplishments

- `domain/mcp-builtin-translation.ts` builds Pi's config from the frozen adapter table: `type: "http"` for remote servers, the transport fields, `oauth` with `redirectUri` renamed `callbackUrl` in place, `timeout` in seconds (ms / 1000), `exposure` (`direct` only for a literal `alwaysLoad: true`), then `description`. No Pi-only power is written.
- `substitute.ts` declares `McpFieldEncoder` and walks the fields through it. `builtin-escape.ts` resolves each reference from the session environment with Claude 2.1.318's rule and escapes `$` and a leading `!` only in `env` and `headers` values.
- `builtin-registration.ts` unregisters stale `plugin_` registrations, then registers each desired config whose JSON differs from Pi's listed copy. Each register call has its own try/catch and logs the name and Pi's message only.
- `builtin-registration-step.ts`: the MSEL-03 gate comes first. Then the user scope, and the project scope only while `ctx.isProjectTrusted()` is true on this call. For each enabled record: containment (marketplace root or plugin clones), `recordedMcpServers` with the record's own marketplace for the legacy reader, built-in classification, `serverName`, and the description. A project server replaces the same-named user server in place. Failures are isolated per scope and per record, and neither step throws.
- `builtin-description.ts` reads the plugin description: plugin.json first, then the marketplace entry, inside the source's manifest boundary. It never throws.
- `listing.feature` has no file-level tag. It holds one `@mcp` scenario, two `@builtin-only` scenarios (BLT-04 listing, BLT-01 tool search), and the `@adapter-only` MSEL-03 scenario. The other scenarios are `@adapter-only` until plan 02-09 lifts them.
- The calls step `the model receives these calls, with each tool search reduced to the tools it loads:` and its lib are in place for the Wave 2 plans.

## Task Commits

1. **Task 1: register one recorded stdio server, nothing under the adapter** - `899100e` (feat)
2. **Task 2: project trust, legacy records, description, record edges** - `a9f6d30` (feat)
3. **Task 3: the tool-search calls step and the listing twin** - `f7478b2` (test)

## TDD Gate Compliance and red runs

The commit hook refuses a test-only commit, so each task committed its tests and code together. These are the red runs (P1-DC-28):

- **Task 1, unit:** `node --test test/orchestrators/mcp/builtin-registration-step.test.ts` against the `87d3f28` seed step: 4 pass, 9 fail. First failure: `BLT-01: registers the recorded stdio server of an enabled user record` with `Error: There are unmet expectations`.
- **Task 1, builtin profile:** `npm run test:cucumber:profile -- --profile builtin features/mcp-server/listing.feature` with the seed step: 2 scenarios, 2 failed. Both failed in `the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`.
- **Task 1, adapter profile with the MSEL-03 gate removed:** 7 scenarios, 2 failed. `Under pi-mcp-adapter the extension registers no server with Pi (MSEL-03)` listed `plugin_demo_stub`. `The mcp tool lists the plugin's server under its generated key` also failed, because the adapter proxied the duplicate `plugin_demo_stub`.
- **Task 2, unit:** the new step test against the Task 1 step (`899100e`): 4 pass, 19 fail. The first failure is the BLT-01 case: Task 1 never asks `isProjectTrusted`, so the strict context mock fails. `builtin-description.test.ts` cannot run before its module exists.
- **Task 3, builtin profile with the seed step:** 3 scenarios, 3 failed, the new twin included (`A search through pi's tool search activates the plugin's tool under Claude Code's name (BLT-01)`, line 44).

## Verification

- Direct coverage at 100% for `domain/mcp-builtin-translation.ts`, `bridges/mcp/{substitute,adapter-entry,builtin-escape,builtin-entry,builtin-registration,builtin-description,index}.ts`, and `orchestrators/mcp/builtin-registration-step.ts`. `adapter-escape.ts` is unchanged.
- Byte identity: `test/bridges/mcp/adapter-entry.test.ts`, `test/integration/adapter-expansion-conformance.test.ts`, and `test/integration/mcp-adapter-entry-conformance.test.ts` pass (123 cases), and `git diff 87d3f28` shows no change in them.
- `npm run check:static` passes: typecheck, lint, fallow (dead code, cycles, health, dupes), format, pairing, and check:features. `npm run test:unpaired` passes.
- Cucumber, builtin profile, `features/mcp-server/listing.feature`: 3 of 3 passed (seed 890229). Adapter profile, the same file: 7 of 7 passed (seed 798557).
- Wider runs: the builtin profile on all of `features`, 42 of 42 passed (seed 310712); the adapter profile on `features/mcp-server`, 66 of 66 passed (seed 713070). The Phase 1 stand-in scenarios still pass beside the extension's own registration.
- MCP unit and integration tests (`test/bridges/mcp`, `test/orchestrators/mcp`, `test/domain/mcp*`, `test/integration/*mcp*`, adapter expansion conformance): 1046 of 1046 passed.
- P2-DC-23 outcome: `npx fallow dupes` reported "No code duplication found" with the description reader in place. **Keep branch:** the module is kept, exported from the barrel, and wired into the step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The encoder parameter keeps a default, and `substitute.ts` still imports `adapter-escape.ts`**
- **Found during:** Task 1
- **Issue:** The plan wants a required third parameter and no `adapter-escape.ts` import in `substitute.ts`. It also wants `test/integration/adapter-expansion-conformance.test.ts` to stay unchanged and pass. That unowned test calls `substituteAndInject(entry, ctx)` with two arguments, so a required parameter fails `tsc`, and at run time the call would throw on an undefined encoder.
- **Fix:** `encoder: McpFieldEncoder = ADAPTER_FIELD_ENCODER`. `adapter-entry.ts` still passes the encoder explicitly, and every `substitute.test.ts` call passes it too. One new case covers the default.
- **Files modified:** `bridges/mcp/substitute.ts`
- **Commit:** `899100e`

**2. [Rule 3 - Blocking] `ADAPTER_FIELD_ENCODER` is exported from `substitute.ts`, not `adapter-escape.ts`**
- **Found during:** Task 1 (`npm run check:static`, fallow)
- **Issue:** With the encoder in `adapter-escape.ts`, no production module imported `serializeSegments` or `serializeLiteral`, so fallow reported both as unused exports. The unchanged integration test needs both exports, so they cannot be removed.
- **Fix:** `substitute.ts` builds `ADAPTER_FIELD_ENCODER` over the two functions, as before, and exports it. `adapter-escape.ts` and `adapter-escape.test.ts` stay unchanged, so the planned `adapter-escape.test.ts` case is in `substitute.test.ts` instead: every existing case passes the encoder, plus the default and routing cases.
- **Files modified:** `bridges/mcp/substitute.ts`, `bridges/mcp/adapter-entry.ts`, `test/bridges/mcp/substitute.test.ts`
- **Commit:** `899100e`

**3. [Rule 3 - Blocking] The step uses the canonical `SCOPES` constant**
- **Found during:** Task 2 (commit hook, `test/architecture/scope-order-drift.test.ts`)
- **Issue:** The literal `["user", "project"]` is banned outside `shared/types.ts`.
- **Fix:** `projectTrusted ? SCOPES : ["user"]`.
- **Commit:** `a9f6d30`

**4. [Rule 2 - Missing] Some edge cases were tested in Task 1, not Task 2**
- **Found during:** Task 1
- **Issue:** The Task 1 step already had the per-record and per-scope catches, and each committed pair needs 100% direct coverage.
- **Fix:** Task 1 already tested the containment refusal, the unreadable legacy record, disabled records, an unreadable state, an unnameable data directory, and a failing registry. Task 2 added the project scope and the remaining rows.

**5. [Rule 1 - Bug] `projectToolSearchResult` is module-private**
- **Found during:** Task 3 (fallow unused export)
- **Fix:** Only `toolSearchCallRows` is exported. The behavior is the same, and the projector's throw and sort rules were checked by hand (see the commands in this plan's run).

**6. Adapter twin install uses the strict setup step**
- The `@adapter-only` MSEL-03 scenario installs with `the user has run "..."`, not `..., which did not fail`. Under the adapter the install output is fixed (IN-02, Pitfall 9 guidance).

## Parent lines

- `test/architecture/manifest-read-agreement.test.ts` (unowned): its header asks every new plugin manifest reader to join the gate (MANF-01). `bridges/mcp/builtin-description.ts` reads `MANIFEST_CANDIDATES` through `locateManifestCandidate`, so it should be added to that gate.
- `test/integration/adapter-expansion-conformance.test.ts` (unowned): pass `ADAPTER_FIELD_ENCODER` at its two `substituteAndInject` calls. Then the encoder parameter can become required and lose its default (P2-DC-19 as planned).
- `features/lib/upstream/`: the tool_search projection in `features/lib/mcp-builtin-tool-search.ts` should move there in Phase 6 (P2-DC-18).
- `.fallowrc.json` (frozen): `orchestrators/mcp/recorded-servers.ts` now has a production consumer, so its `entry` and `ignoreExports` items can go in Phase 6 (RESEARCH Q7).
- `.planning/codebase/CONVENTIONS.md`: no new fallow marker was added. The step test and the registration test add three reasoned `@typescript-eslint/unbound-method` disables, which follow the strong-mock precedent.

## Known Stubs

None. Every listing scenario the plan did not lift stays `@adapter-only` by design. Plan 02-09 lifts the rest.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-01 (encoder escapes), T-02-02 (containment before any read), T-02-04 (name-only logs), T-02-05 (closed table), T-02-06 (MSEL-03 gate), T-02-07 (trust per call), T-02-08 (no file written), and T-02-09 (per-call and whole-sync try/catch) are implemented and unit-tested.

## Dubious Choices

**DC-A: The encoder parameter keeps a default value (reverses P2-DC-19)**
- **Choice:** `substituteAndInject(translated, ctx, encoder = ADAPTER_FIELD_ENCODER)`.
- **Alternatives:** (a) A required parameter, which breaks the unowned integration test that must stay unchanged. (b) A second walk export. (c) Editing the integration test.
- **Why dubious:** A caller that forgets the encoder silently gets the adapter's encoding. Every production caller passes one explicitly, and the parent line above removes the default later.
- **Severity:** Low.

**DC-B: `ADAPTER_FIELD_ENCODER` lives in `substitute.ts`**
- **Choice:** The shared walk hosts the adapter's encoder, built over `adapter-escape.ts`, which stays unchanged.
- **Alternatives:** Export it from `adapter-escape.ts` and add `fallow-ignore` unused-export markers to `serializeSegments` and `serializeLiteral`.
- **Why dubious:** The walk is not fully implementation-neutral: it knows the adapter's encoder. The alternative adds suppression markers whose only consumers are tests.
- **Severity:** Low.

**DC-C: The description reader treats a directory spelled `plugin.json` as no manifest, and any other read error as a present manifest that cannot be used**
- **Choice:** It matches the resolver (stat `isFile`) and D-01-07 (a stat this process may not make counts as present). The EACCES case is covered by a `chmod 000` test, as other repo tests are.
- **Alternatives:** Treat every read error as absent.
- **Why dubious:** The test depends on running without DAC override (CI's non-root user, or the nondac wrapper).
- **Severity:** Low.

**DC-D: A record with an empty server list skips the description and data-directory reads**
- **Choice:** Return early when `recorded.servers` is empty.
- **Alternatives:** Read the description for every record.
- **Why dubious:** None functionally. A plugin with no servers registers nothing either way. It is listed because the plan did not name it.
- **Severity:** Low.

**DC-E: The description of a plugin the manifest no longer lists is read inside a plugin-directory-only boundary**
- **Choice:** With no manifest entry, `sourceManifestBoundary(undefined, ...)` gives the copy boundary, so a path plugin read in place cannot follow a link into its marketplace directory.
- **Alternatives:** Use the in-place boundary when no `pin` is recorded.
- **Why dubious:** A path plugin whose plugin.json links into the marketplace tree loses its description after the manifest drops it. Such a record is usually unreadable by the legacy reader anyway.
- **Severity:** Low.

**DC-F: The tool-search projector skips blank lines and accepts any tool name in a loaded line**
- **Choice:** It is tolerant and anchored on the `- <name>: <description>` shape. It throws when the header does not say it loaded tools or when no tool line is found.
- **Alternatives:** Anchor on `mcp__` names only.
- **Why dubious:** A search that also loads another extension's deferred tool would list that tool. That is correct (the whole set the search loads), but it ties a scenario to the other tools a profile loads.
- **Severity:** Low.

## Self-Check: PASSED

- All created and modified files listed above exist in the worktree.
- Commits `899100e`, `a9f6d30`, and `f7478b2` are ancestors of HEAD.
