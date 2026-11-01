---
phase: 06-mcp-servers
plan: 01
subsystem: testing
tags: [cucumber, pi-mcp-adapter, mcp, registry-probe, scripted-model]

requires:
  - phase: 01-harness
    provides: profile Pi, scripted model, registry probe, MCP stub, frozen fixture writers
provides:
  - "features/mcp-server/listing.feature: MCP-01 listing and naming scenarios with two negative controls"
  - "features/mcp-server/project-scope.feature: the moved allowed project-scope scenario"
  - "features/step_definitions/mcp-server/listing.steps.ts: the ten shared MCP steps"
  - "features/lib/mcp-server-files.ts: stubServerEntry, withStubServers, publishStubServersFile, setPublishedEntryMcpServers, removePublishedPluginManifest, publishMcpServerAgent, writeMcpAdapterOverride"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-09]

actuals:
  tokens: 11404
  tasks: 3
  commits: 5
plan_head_before: 848dd520b0e66b573b406000806142793c93ccae
plan_head_after: 4550c81d895a119b6e02e434640f1112305ee39d

tech-stack:
  added: []
  patterns:
    - "Registry probe read until two reports 250 ms apart agree (pi-mcp-adapter registers listed tools after it closes the listing connection)"
    - "Fixture JSON with {\"stub\": {...}} markers expanded into stub server entries"
    - "Writers that only later step modules import carry a /** @public */ JSDoc tag"

key-files:
  created:
    - features/mcp-server/listing.feature
    - features/mcp-server/project-scope.feature
    - features/step_definitions/mcp-server/listing.steps.ts
  modified:
    - features/lib/mcp-server-files.ts
    - features/mcp-server/invocation.feature
  deleted:
    - features/step_definitions/mcp-server/calls.steps.ts

key-decisions:
  - "The server-listing scenario connects before it lists, because the lazy listing text holds an em dash that the fix-unicode-dashes pre-commit hook rewrites in any committed feature file"
  - "The registry-probe When waits for two equal reports 250 ms apart, because the listing wait can end before pi-mcp-adapter registers the deferred tool"
  - "Writers and types with no consumer until wave 2 carry /** @public */, the one fallow exemption that does not go stale once wave 2 imports them"

patterns-established:
  - "Shared MCP steps live in features/step_definitions/mcp-server/listing.steps.ts; wave-2 verb modules never redefine them"

requirements-completed: [MCP-01]

coverage:
  - id: D1
    description: "A scripted mcp search activates mcp__plugin_demo_stub__echo; call 1 is offered no plugin tool, call 2 is; the stub logs one listing round"
    requirement: MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A search through the mcp tool activates the plugin's tool under Claude Code's name"
        status: pass
    human_judgment: false
  - id: D2
    description: "The mcp tool's status, connect, and server listing show the key plugin_demo_stub_ and Claude Code's tool name, compared whole"
    requirement: MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#The mcp tool lists the plugin's server under its generated key"
        status: pass
    human_judgment: false
  - id: D3
    description: "The registry probe lists mcp active and mcp__plugin_demo_stub__echo registered but inactive before any search; servers api and my.db give mcp__plugin_demo_api__echo and mcp__plugin_demo_my_db__echo (ANAME-01)"
    requirement: MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#Pi registers the plugin's tool under Claude Code's name, inactive until a search"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/listing.feature#Each server of a plugin gets tools named after the plugin and the server"
        status: pass
    human_judgment: false
  - id: D4
    description: "Negative controls: no MCP server gives MCP: 0/0 servers, 0 tools and an empty stub log; a search for nothing activates no tool"
    requirement: MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A plugin without MCP servers adds no server to pi-mcp-adapter"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A search that matches no tool activates none"
        status: pass
    human_judgment: false
  - id: D5
    description: "Shared steps moved to listing.steps.ts, seeds unchanged and passing, project-scope scenario moved verbatim and passing"
    verification:
      - kind: e2e
        ref: "npx cucumber-js features/mcp-server (9 scenarios, seeds 510238, 598708, 603631)"
        status: pass
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false
  - id: D6
    description: "The seven fixture writers wave 2 needs exist and behave as specified"
    verification:
      - kind: other
        ref: "scratch smoke script exec-06-01/smoke.ts (not committed; no scenario in this plan calls the four Task 3 writers)"
        status: pass
    human_judgment: true
    rationale: "No committed test calls stubServerEntry directly or the four Task 3 writers; their first committed callers are the wave-2 step modules"

duration: 40min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 01: MCP server listing tracer and shared MCP steps Summary

**A scripted `mcp({ search: "echo" })` activates `mcp__plugin_demo_stub__echo` under pi-mcp-adapter 7.0.0, proved by the per-call tool lists, the stub log, and the registry probe. Wave 2 gets ten shared MCP steps in `listing.steps.ts` and seven fixture writers in `mcp-server-files.ts`.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-11-01T14:20Z
- **Completed:** 2026-11-01T15:00Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 2 modified, 1 deleted by rename)

## Accomplishments

- `features/mcp-server/listing.feature` (`Feature: MCP server listing`, six scenarios): the search tracer, the adapter's status, connect, and server listings, the registry-probe naming, two servers of one plugin (ANAME-01), and two negative controls. Every expected value is compared whole.
- `features/step_definitions/mcp-server/listing.steps.ts` holds every shared MCP step. `calls.steps.ts` is gone, and the seed scenarios pass with their text unchanged.
- `features/mcp-server/project-scope.feature` (`Feature: MCP server project scope`) holds the allowed project-scope scenario, moved verbatim.
- `features/lib/mcp-server-files.ts` exports the seven writers wave 2 needs. The four seed exports keep their behavior.

## Task Commits

1. **Task 1: search activates the plugin's tool (tracer)**: `f583867` (step move, its own commit per D-08), `da96ad4` (listing scenario and per-call tools step)
2. **Task 2: listing, status, registry, per-server naming, negative controls**: `508a2c5`
3. **Task 3: project-scope feature, token-aware stub steps, remaining writers**: `e3855ac` (scenario move, its own commit), `4550c81` (writers and token expansion)

The tracer gate re-ran `npx cucumber-js features/mcp-server` and `npm run check:features` after Task 1: three green runs before expansion.

## Step texts added

Moved unchanged from `calls.steps.ts`:

- `the published plugin {string} of the marketplace {string} has the stub mcp server {string}`
- `the published plugin {string} of the marketplace {string} has the stub mcp server {string} with "STUB_TAG" set to "${PI_CM_STUB_TAG:-install-default}"`
- `pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}`
- `pi-mcp-adapter has listed the tools of the stub mcp server {string} of the plugin {string}` (now expands run tokens in the plugin parameter)
- `the stub mcp server {string} of the plugin {string} receives these messages:` (now expands run tokens in the plugin parameter)

New:

- Given `the published plugin {string} of the marketplace {string} has the file {string} with these stub mcp servers:` (doc string, `{"stub": {"plugin"?, "env"?}}` markers)
- When `the user lists the mcp tools pi offers`
- Then `pi offers these mcp tools:` (`| tool | active |`, the `mcp` proxy and every `mcp__` tool, in Pi's order)
- Then `the model calls are offered these tools:` (`| call | tools |`, names joined with `, `; it does not mark the turn compared)
- Then `no stub mcp server receives a message`

## Measured literals (adapter 7.0.0, Pi 1.4.0)

These match the research probe P1:

- Call 1 tools: `read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp`. After the search, call 2 adds `mcp__plugin_demo_stub__echo`.
- Search result: `Activated as direct tools: mcp__plugin_demo_stub__echo.\n\nFound 1 tool matching "echo":\n\nmcp__plugin_demo_stub__echo\n  Echoes the text it is given.\n\n  Shape:\n    { text: string; }`
- Lazy status: `MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_stub_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search`
- Lazy server listing: as in the research, with an em dash. It is not pinned; see Deviations.

These were new, measured here:

- `mcp({ connect: "plugin_demo_stub_" })` and the server listing after the connect: `plugin_demo_stub_ (1 tools):\n\n- mcp__plugin_demo_stub__echo(text) - Echoes the text it is given.`
- Status after a connect: `MCP: 1/1 servers, 1 tools\n\n✓ plugin_demo_stub_ (1 tools, legacy notification path)\n\nmcp(...)`. It is not pinned, because the scenario lists the status before it connects.
- A plugin without MCP servers: `mcp({})` returns exactly `MCP: 0/0 servers, 0 tools`, and the install emits no warning.
- `mcp({ search: "nothing" })`: `No tools matching "nothing"`, and call 2 keeps the call-1 tool list.
- Registry probe: `mcp` is active and `mcp__plugin_demo_stub__echo` is inactive. The servers `api` and `my.db` give `mcp__plugin_demo_api__echo` and `mcp__plugin_demo_my_db__echo`. The probe lists `codemode` and `tool_search` too, but the `mcp`/`mcp__` filter leaves them out.
- The probe can run before the deferred tool registers. One parallel run reported only `mcp`. pi-mcp-adapter closes the listing connection, so the stub exits, before `saveMetadataCache` and `syncToolSurface` run (`init.ts` around line 430, `index.ts` around line 1541).

## Files Created/Modified

- `features/mcp-server/listing.feature`: the MCP-01 listing and naming scenarios
- `features/mcp-server/project-scope.feature`: the moved allowed project-scope scenario, which plan 06-05 extends
- `features/mcp-server/invocation.feature`: lost the project-scope scenario; the other two are unchanged
- `features/step_definitions/mcp-server/listing.steps.ts`: the shared MCP steps (renamed from `calls.steps.ts`)
- `features/lib/mcp-server-files.ts`: the stub-server, server-source, agent, and override writers

## Decisions Made

- Moved the project-scope scenario, which was the CONTEXT discretion item (recommended: move).
- The When `the user lists the mcp tools pi offers` is a Phase 6 step built on the frozen `readRegistrySnapshot`. Its shape differs from the frozen slash-command When (a settle loop), and `npx fallow dupes` reports no clone group, so the fallback to the frozen When was not needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The lazy server listing cannot be pinned in a committed feature file**
- **Found during:** Task 2
- **Issue:** `mcp({ server: "plugin_demo_stub_" })` on a lazy server returns `... not connected yet — mcp({ connect: ... }) to connect ...` with an em dash (U+2014). The texthooks `fix-unicode-dashes` pre-commit hook covers `features/**` and rewrites U+2014 to `--`. The CI Lint job runs it on every file, so the literal can never be committed, and the frozen `the model receives these calls:` step has no projection for it.
- **Fix:** The scenario "The mcp tool lists the plugin's server under its generated key" runs `mcp {}` (lazy status, no em dash), then `mcp {"connect": "plugin_demo_stub_"}`, then `mcp {"server": "plugin_demo_stub_"}`. All three are compared whole and show the key `plugin_demo_stub_` and Claude Code's tool name.
- **Files modified:** `features/mcp-server/listing.feature`
- **Commit:** `508a2c5`

**2. [Rule 1 - Bug] The registry probe flipped under parallel load**
- **Found during:** Task 2, first run (8 parallel workers)
- **Issue:** The listing wait ends when the stub exits. pi-mcp-adapter registers the deferred tool after that, so one probe saw only `mcp`.
- **Fix:** The When reads the probe until two reports 250 ms apart agree, within the listing deadline of 15 s. This is the same quiet-window idea the session driver uses. The adapter's own readiness signal (`pi-mcp-adapter/status/v1`) is not visible to a step.
- **Files modified:** `features/step_definitions/mcp-server/listing.steps.ts`
- **Verification:** Every later run passed: 4 isolated runs of the two probe scenarios, then 3 runs of the 9 MCP scenarios after Task 2 and 3 more after Task 3.
- **Commit:** `508a2c5`

**3. [Rule 3 - Blocking] The writers wave 2 needs are unused exports in wave 1**
- **Found during:** Task 2 (`npm run check:static`, fallow dead-code)
- **Issue:** `stubServerEntry`, `withStubServers`, the types `StubServerOptions` and `StubServerEntry`, and the four Task 3 writers have no importer until wave 2. Each choice fails a gate:
  - A plain export fails the wave-1 `npm run check`.
  - A `fallow-ignore` or `@expected-unused` marker goes stale once wave 2 imports the writer, in a file wave 2 may not edit.
  - Unexporting the types makes a private-type leak.
- **Fix:** Each of those eight exports carries a `/** @public */` JSDoc tag, which fallow never reports as unused or stale. The file overview says why. `publishStubServersFile` needs no tag, because this plan's Given imports it.
- **Files modified:** `features/lib/mcp-server-files.ts`
- **Commits:** `508a2c5`, `4550c81`

**4. [Rule 1 - Bug] Scenario title casing**
- **Found during:** Task 2 (`npm run check:features`)
- **Issue:** The title "pi-mcp-adapter lists the plugin's server under its generated key" does not start upper case.
- **Fix:** Renamed it to "The mcp tool lists the plugin's server under its generated key".
- **Commit:** `508a2c5`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs).
**Impact on plan:** The lazy-listing literal is the only expected value the plan named that is not pinned. Its key and tool name are pinned through the connected listing. No product file changed.

## Issues Encountered

- No red proof applies. These scenarios pin existing adapter 7.0.0 behavior, and MCP-01 holds. No product break was found.
- No committed test calls the four Task 3 writers, `stubServerEntry`, or the marker error paths of `withStubServers`. A scratch smoke script (`/tmp/claude-0/-home-user-pi-claude-marketplace/5aec957e-dc04-5dcd-ad24-f2ccbabeb40f/scratchpad/exec-06-01/smoke.ts`) exercised each one against a temporary dir publication: the marker expansion, `__proto__`, the error paths, the entry rewrite, the manifest removal and its refusals, both agent forms, and the override merge. It passed. It left one `/tmp/smoke-*` directory, whose removal the sandbox refused.
- The token expansion of the plugin parameter is used only with plain names in this plan. Its first token-bearing caller is in wave 2.

## Next Phase Readiness

- Wave 2 (06-02..06-06) can use every shared step and writer without editing `listing.steps.ts` or `mcp-server-files.ts`.
- Wave-2 authors should know that adapter text with an em dash cannot be pinned in a feature file (Deviation 1). The lazy server listing and any other `—`-bearing adapter message need another observation.
- A probe-based Then must use `the user lists the mcp tools pi offers`, which settles. The frozen slash-command When reads the probe once.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. `removePublishedPluginManifest` refuses git and hosted publications and paths outside the published root (T-06-01). `writeMcpAdapterOverride` writes only the path its caller gives, which is the sandbox's `mcp-adapter.json`.

## Parent lines

- `.agents/skills/cucumber/rules/layout.md`, "Function directories" table, MCP servers row: the seed step module is now `features/step_definitions/mcp-server/listing.steps.ts`, not `features/step_definitions/mcp-server/calls.steps.ts`.
- After wave 2 merges, remove the `/** @public */` tags from `features/lib/mcp-server-files.ts` for every export that a step module then imports (`StubServerOptions`, `StubServerEntry`, `stubServerEntry`, `withStubServers`, `setPublishedEntryMcpServers`, `removePublishedPluginManifest`, `publishMcpServerAgent`, `writeMcpAdapterOverride`). Delete any writer that nothing imports. The tags otherwise stop fallow from ever reporting these exports as dead.
- Phase 6 log (the orchestrator appends): the em-dash limit on pinned adapter literals (Deviation 1) and the probe settle window (Deviation 2).

## Self-Check: PASSED

- FOUND: features/mcp-server/listing.feature, features/mcp-server/project-scope.feature, features/step_definitions/mcp-server/listing.steps.ts, features/lib/mcp-server-files.ts
- ABSENT as required: features/step_definitions/mcp-server/calls.steps.ts
- FOUND commits: f583867, da96ad4, 508a2c5, e3855ac, 4550c81 (5 commits, measured `git rev-list --count 848dd52..HEAD`)
- Acceptance criteria of all three tasks re-run: all PASS
- Plan verification: `npx cucumber-js features/mcp-server` 9/9 passed three times (seeds 510238, 598708, 603631); `npm run check:static` passed; `npx fallow dupes` reported no clone group

## Dubious Choices

1. **Connect before listing in the server-listing scenario.** Alternatives: pin the lazy listing through a Phase 6 step that projects `—` to a token, which would duplicate the frozen calls step; or ask the parent to exclude `features/` from `fix-unicode-dashes`. Dubious because the lazy form of `mcp({ server })`, the one a model sees first, is still not compared whole.
2. **A 250 ms quiet window in the registry-probe When.** Alternatives: wait for the adapter's `mcp-cache.json`, a companion file that still leaves an async gap; or wait until a computed tool name appears, which would build the naming rule into the wait. Dubious because a quiet window is a heuristic, not a readiness signal. A slower adapter could still beat it in theory.
3. **`/** @public */` on eight exports with no importer yet.** Alternatives: plain exports, which fail the wave-1 gate; `fallow-ignore` or `@expected-unused`, which go stale in wave 2; or moving the writers into the wave-2 plans, which breaks the disjoint-ownership plan. Dubious because the tags hide real dead code until someone removes them (parent line above).
4. **Array elements of a stubs document are never expanded as markers**, because a server needs a member key for its name. An array element `{"stub": {}}` is written as it is. The plan's "every object member" wording reads this way, but a wave-2 author might expect otherwise.
5. **`publishMcpServerAgent` body text** "Call the tools the task names." and description "Calls the tools the task names." were chosen here. The plan fixed only the description.
