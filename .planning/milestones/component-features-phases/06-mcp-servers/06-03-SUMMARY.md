---
phase: 06-mcp-servers
plan: 03
subsystem: domain
tags: [mcp, pi-mcp-adapter, resolver, typebox, cucumber]

requires:
  - phase: 06-mcp-servers
    provides: "06-01 shared MCP steps (stub-servers file Given, listing wait, registry probe When/Then) and the writers withStubServers, setPublishedEntryMcpServers, removePublishedPluginManifest"
provides:
  - "domain/mcp-resolution.ts: the ordered merge of a plugin's MCP sources (.mcp.json, then the manifest, or the entry when there is no plugin.json), references, arrays, and bundles"
  - "domain/components/mcp.ts: MCP_SERVERS_SCHEMA (server map or array of references and maps) and MCP_SERVER_MAP_VALIDATOR"
  - "features/mcp-server/sources.feature: six FG-27 scenarios"
  - "features/step_definitions/mcp-server/sources.steps.ts: the marketplace-entry and no-plugin.json Givens"
affects: [06-07, 06-08, 06-09]

actuals:
  tokens: 16757
  tasks: 3
  commits: 5
plan_head_before: 38f3900e2eae43d2ac45a3fef8cb3aee95395a16
plan_head_after: afdd2667484a2753a43dddfcb9b13fca41280f67

tech-stack:
  added: []
  patterns:
    - "One Map accumulator keyed by server name: Map.set keeps the first position on replace, Object.fromEntries keeps __proto__ an own server"
    - "Blocked servers are dropped after the merge, so a later supported server of the same name wins"

key-files:
  created:
    - features/mcp-server/sources.feature
    - features/step_definitions/mcp-server/sources.steps.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - extensions/pi-claude-marketplace/domain/components/mcp.ts
    - test/domain/mcp-resolution.test.ts
    - test/domain/components/mcp.test.ts
    - test/domain/components/plugin.test.ts
    - test/domain/plugin-resolver.test.ts

key-decisions:
  - "An array with an element that is neither a reference nor a server map is refused whole, with the one note the server-map check gives for that element"
  - "A .mcpb or .dxt reference adds the mcpServers unsupported kind with no note; the refused install already shows {unsupported mcp} and the --partial hint"
  - "The no-plugin.json Given names its kind in the step text, as the layout rule requires of a phase's steps"

patterns-established:
  - "MCP source scenarios tag each stub server's echo with the source that declared it (STUB_TAG), so the winning declaration shows in the call result"

requirements-completed: [MCP-04]

coverage:
  - id: D1
    description: ".mcp.json a, c plus plugin.json a, b give pi-mcp-adapter the servers a, c, b in that order, and a answers a-manifest:echo:ping"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/sources.feature#A plugin's MCP servers are the union of its .mcp.json and its plugin.json, the later declaration winning a shared name"
        status: pass
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts#D-CF6-01: merges .mcp.json and the manifest, a later server replacing an earlier one in place"
        status: pass
    human_judgment: false
  - id: D2
    description: "plugin.json mcpServers [\"./a.json\", {y}, \"./b.json\"] beside .mcp.json x, z gives x, z, y with x from the unwrapped b.json; the plugin schemas admit the array"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/sources.feature#An array of MCP sources is read in order, a later one replacing an earlier server"
        status: pass
      - kind: unit
        ref: "test/domain/components/mcp.test.ts and test/domain/components/plugin.test.ts (array accept and refuse rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Without a plugin.json the entry's servers come after .mcp.json and win a shared name; with a plugin.json the entry's servers are ignored"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/sources.feature#Without a plugin.json, the marketplace entry declares the plugin's servers after its .mcp.json"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/sources.feature#With a plugin.json, the marketplace entry's servers are ignored"
        status: pass
    human_judgment: false
  - id: D4
    description: "An .mcpb source makes a normal install refuse the plugin as partially-available {unsupported mcp} with the partial-install hint; a reference without ./ still loads"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/sources.feature#An .mcpb bundle source makes the plugin partially available"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/sources.feature#A server reference without ./ still loads, a recorded residual (D-CF6-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "File defects keep today's notes and stay fatal; absolute, escaping, and symlinked references are never read (T-06-07); __proto__ stays an own server (T-06-08)"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts (100% direct coverage: branches 72/72, functions 18/18)"
        status: pass
      - kind: unit
        ref: "npm run test:modules"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 03: MCP server sources merge Summary

**A plugin's MCP servers are now the ordered union of `.mcp.json` and the declared `mcpServers` (the plugin.json value, or the marketplace entry's when there is no plugin.json), read as a reference, an inline map, or an array of both, with a later same-name server replacing the earlier one in place, as Claude Code 2.1.316 merges them (D-CF6-01).**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-01T15:25:05Z
- **Completed:** 2026-11-01T16:15:05Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `resolveStrictMcp` reads `<pluginRoot>/.mcp.json` first, then the declared value. It reads the entry only when `manifest` is `null`. A string is a reference: containment runs first, then a `.mcpb`/`.dxt` bundle becomes the `mcpServers` unsupported kind, else the file is read. A plain object is an inline map. An array is read element by element. A file holds its servers with or without the `mcpServers` wrapper. Blocked servers are split out after the merge.
- `MCP_SERVERS_SCHEMA` is the declared-value union (server map, or array of reference strings and server maps). `domain/components/plugin.ts` takes the array form with no edit. `MCP_SERVER_MAP_VALIDATOR` replaces the old `MCP_SERVERS_VALIDATOR`, which no production module needed any more.
- `features/mcp-server/sources.feature` (`Feature: MCP server sources`) has six scenarios, each compared whole: the `.mcp.json` + plugin.json merge, the array, the entry without a plugin.json, the entry ignored with a plugin.json, the `.mcpb` refusal, and the reference without `./`.
- File defects are unchanged and fatal: a missing reference, unparseable JSON, a non-object map, or a malformed server adds today's note. A read failure propagates. Plan 06-07 changes the file-source cases.

## Task Commits

1. **Task 1: merge .mcp.json and plugin.json servers (tracer)**: RED `a798ddf` (test, scenario), GREEN `3e18c5d` (feat, resolver, unit tests, the two plugin-resolver pins)
2. **Task 2: array of MCP sources**: RED `e121345` (test, scenario), GREEN `623cffa` (feat, schema, schema tests)
3. **Task 3: entry rule, bundle, reference residual**: `afdd266` (test, four scenarios and the step module)

The tracer gate re-ran the Task 1 `<verify>` before expansion: the unit files, direct coverage, `npx cucumber-js features/mcp-server/sources.feature` three times (seeds 466407, 132025, 991180), and `npm run check:features`. All passed.

## Red proofs

**Merge scenario, before the resolver change** (seed 991310). The run failed in the listing wait for `c`, because the resolver read only the plugin.json value and never read `.mcp.json`:

```
Failed scenarios:
  1) A plugin's MCP servers are the union of its .mcp.json and its plugin.json, the later declaration winning a shared name # features/mcp-server/sources.feature:9
       Given pi-mcp-adapter has listed the tools of the stub mcp server "c" of the plugin "demo" # features/step_definitions/mcp-server/listing.steps.ts:190
           AssertionError [ERR_ASSERTION]: pi-mcp-adapter did not finish listing the tools of demo/c: {"requests":[... only servers "b" and "a" ...],"running":[]}
1 scenario (1 failed)
15 steps (10 passed, 4 skipped, 1 failed)
```

**Array scenario, before the schema change** (seed 664426). The install was refused, because `PLUGIN_MANIFEST_VALIDATOR` rejected the array:

```
Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned # features/step_definitions/command.steps.ts:70
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + [ { kind: 'cascade', marketplaces: [ { name: 'fixtures', plugins: [ { id: 'demo@fixtures', name: 'demo',
  +     reasons: [ 'unsupported source' ], status: 'unavailable' } ], scope: 'user' } ], ..., severity: 'error',
  +     summary: 'A plugin operation has failed.' } ]
  - []
1 scenario (1 failed)
17 steps (9 passed, 7 skipped, 1 failed)
```

The four Task 3 scenarios pin behavior that Tasks 1 and 2 shipped, so their red runs were not measured. Reading the old code: before Task 1, the entry `{d}` would have won over `.mcp.json` `{h}`, and the `.mcpb` reference would have been parsed as JSON and failed as `{malformed mcp}`.

## Measured literals (adapter 7.0.0, Pi 1.4.0)

- Status with three merged servers: `MCP: 0/3 servers, 3 tools\n\n○ plugin_demo_a_ (1 tools, cached; not listening)\n○ plugin_demo_c_ (1 tools, cached; not listening)\n○ plugin_demo_b_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search`. The adapter lists servers in the order this extension writes them, so the status line shows the merge order.
- `.mcpb` install: `kind cascade`, `severity error`, `needs reload false`, `summary A plugin operation has failed.`, row `demo@fixtures partially-available` with reason `unsupported mcp` and hint `partial-install`.
- None of the pinned literals holds an em dash.

## Out-of-ownership test edits (expected outcomes only)

- `test/domain/plugin-resolver.test.ts`:
  - "MCPR-03 wrapper-less reference file (bare map) -> unavailable + malformed mcp reference note" is now "MCPR-03 wrapper-less reference file (bare map) resolves installable with its server (D-CF6-01)". It expects `installable` with `{ srv }`, and its inline comment cites D-CF6-01 in place of D-04.
  - "MCPR-01 backstop: string entry.mcpServers shadows an object manifest.mcpServers (entry wins)" is now "MCPR-01 backstop: with a plugin.json, the manifest object resolves and the entry string is ignored (D-CF6-01)". It expects `{ other: { command: "python" } }`. The three-line comment directly above the test changed too (see Deviation 3).
- `test/domain/components/plugin.test.ts`:
  - "describes the complete plugin entry object" expects the nested `anyOf` with the array branch.
  - Both "rejects the MCP declaration" lists are now `[null, [1], 1, true]`: `[]` is removed and `[1]` added.
  - Each accepted-shapes table has one new row, "an array of MCP file references and server maps".
  - The `@ts-expect-error` comment is unchanged.
- `git diff 38f3900..HEAD -- extensions/pi-claude-marketplace/domain/components/plugin.ts extensions/pi-claude-marketplace/domain/plugin-resolver.ts` is empty.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-resolution.ts`: the ordered merge (D-CF6-01)
- `extensions/pi-claude-marketplace/domain/components/mcp.ts`: the widened declaration schema and the server-map validator
- `features/mcp-server/sources.feature`: six MCP-04 scenarios
- `features/step_definitions/mcp-server/sources.steps.ts`: the entry-servers and no-plugin.json Givens
- `test/domain/mcp-resolution.test.ts`: 49 cases, 100% direct coverage of the resolver
- `test/domain/components/mcp.test.ts`: the schema shape, eight declaration rows, and the server-map validator rows
- `test/domain/components/plugin.test.ts`, `test/domain/plugin-resolver.test.ts`: the expected-outcome edits above

## Decisions Made

- The bundle case adds no note. The refused install already names `{unsupported mcp}` and hints `--partial`. The flagged assumption held, and no closed set changed.
- MM-7 is unchanged. No `strict: false` conflict is raised for `mcpServers`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow private-type leak**
- **Found during:** Task 1 (`npm run check:static`)
- **Issue:** `resolveStrictMcp`'s signature used the module-private `McpResolutionDependencies` interface.
- **Fix:** The exported signature keeps its inline dependency type. The private interface types the internal merge state.
- **Files modified:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts`
- **Committed in:** `3e18c5d`

**2. [Rule 2 - Convention] The no-plugin.json step names its kind**
- **Found during:** Task 3
- **Issue:** The plan's step text `the published plugin {string} of the marketplace {string} has no plugin.json` does not name `mcp`. The cucumber layout rule says a step a phase adds names its kind, so two phases never define the same text. The plan's own shared rule says the same ("every step this plan adds names `mcp` and its topic").
- **Fix:** The text is `the published plugin {string} of the marketplace {string} has no plugin.json, so its marketplace entry declares its mcp servers`. `grep -c 'has no plugin.json'` still prints 1.
- **Committed in:** `afdd266`

**3. [Rule 1 - Stale comment] The comment above the MCPR-01 backstop test**
- **Found during:** Task 1
- **Issue:** The three comment lines directly above the test said that a string entry wins over the manifest object. That is false after D-CF6-01.
- **Fix:** They now cite D-CF6-01 and say that the entry is ignored with a plugin.json. These lines sit just outside the test body, which goes one step past the strict reading of the `git diff` criterion.
- **Committed in:** `3e18c5d`

**4. [Rule 2 - Test strength] Whole-value assertions in two weak cases**
- **Found during:** Task 1
- **Issue:** "rejects malformed JSON in a string reference" and "classifies malformed JSON content in a standalone document" asserted only a note prefix.
- **Fix:** Both compare whole `{ dirty, resolution }` values. The parser message comes from a test helper that calls `JSON.parse` itself, never production code. "classifies a wrapped malformed map like an inline malformed map" now uses the inline value `5`, because `["invalid"]` is a valid reference list after D-CF6-01.
- **Committed in:** `3e18c5d`, `623cffa`

---

**Total deviations:** 4 auto-fixed (1 blocking, 2 convention or strength, 1 stale comment).
**Impact on plan:** None on behavior. Deviations 2 and 3 are wording choices, listed again under Dubious Choices.

## Issues Encountered

- The TDD RED evidence is a cucumber console report. `gsd-tools check tdd-red-evidence` has no adapter for that format, so the classifier was not run. The semantic check: each RED run failed in the planned step for the planned reason. The first failed in the listing wait for the server that only `.mcp.json` declares. The second failed in the install refusal from the manifest schema.
- The commit titles use `test(mcp)` and `feat(mcp)`, not `test(06-03)`, per the child-session rules. So the TDD gate's grep finds no plan-scoped commit. The RED and GREEN hashes are listed above.

## Verification

- `node --test` on the four changed unit files: pass (239 resolver cases, 101 schema and resolver cases).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/mcp.ts extensions/pi-claude-marketplace/domain/components/plugin.ts extensions/pi-claude-marketplace/domain/mcp-resolution.ts`: pass. `mcp-resolution.ts` has branches 72/72, functions 18/18, and lines 286/286.
- `npx cucumber-js features/mcp-server/sources.feature`: 6/6, three times in a row (seeds 670436, 857029, 126788).
- `npx cucumber-js features/mcp-server features/plugin/apply.feature features/plugin/staging-warnings.feature features/plugin/update.feature features/marketplace/update.feature`: 210/210 (seed 464383). These features declare MCP servers or MCP configuration.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): pass after each task. `npx fallow dupes`: no clone group.
- `npm run test:modules`: exit 0. `npm run test:integration`: exit 0.

## Next Phase Readiness

- Plan 06-07 can switch the file-source defects to silent skips inside `readJsonFile`, `readStandaloneMcp`, `readReferencedMcp`, and `mergeServers` (dirty only for inline sources). The merge keeps an earlier server when a later one is malformed. Upstream's `mit` behaves the same way, because it drops an invalid server before it spreads.
- Plan 06-09 documents the merge order, the array form, the bundle refusal, and the `./` residual in `docs/mcp-compatibility.md`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-07 is covered: containment runs before any stat or read, and the symlink case asserts that only `.mcp.json` was read. T-06-08 is covered by the `Map` and `Object.fromEntries` accumulator and the `__proto__` case. T-06-09 is covered: a bundle is never read, and the normal install refuses the plugin (scenario).

## Parent lines

- PRD `docs/prd/pi-claude-marketplace-prd.md` MC-1 (about lines 477-479): "first match wins, no merge" is superseded by D-CF6-01. The ordered union is `.mcp.json`, then the manifest, or the entry when there is no plugin.json, with the array form. MC-3's wrapped-only reference wording is superseded as well.
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` lines 48-52: the comment says the server-map validator `MCP_SERVERS_SCHEMA / MCP_SERVERS_VALIDATOR` "stays object-only" and that a reference points at a wrapped `.mcp.json`. Now `MCP_SERVERS_SCHEMA` is the declared-value union (map or array), the map check is `MCP_SERVER_MAP_VALIDATOR`, and a referenced file may be unwrapped. The field comments near lines 65 and 102 ("string reference OR inline map") should add the array form.
- `test/domain/plugin-resolver.test.ts`: the section comment near line 1684 ("string mcpServers references (wrapped .mcp.json, D-01/D-04)") is stale. So is the "criterion 5" comment near line 2018 ("The wrapped-only rule applies ONLY to the declared string reference"). Both sit outside this plan's named tests.
- `test/domain/components/plugin.test.ts`: the `@ts-expect-error` comment "MCP servers are a file reference or a server map." could add "or an array of both". It was left unchanged per the plan.
- `docs/output-catalog.md` lines 148, 736, 3395: "wrapper-less" is still listed as a broken `mcpServers` string reference. A wrapper-less reference now loads.
- `features/lib/mcp-server-files.ts`: this plan imports `withStubServers`, `setPublishedEntryMcpServers`, and `removePublishedPluginManifest`, so their `/** @public */` tags can go in the 06-01 cleanup.
- `CHANGELOG.md`: a plugin's MCP servers now merge from `.mcp.json` and its declared `mcpServers` (an object, a reference, or an array) in Claude Code's order. Without a plugin.json, the marketplace entry declares them. A referenced file may omit the `mcpServers` wrapper. An `.mcpb` or `.dxt` source makes the plugin partially available.

## Self-Check: PASSED

- FOUND: features/mcp-server/sources.feature, features/step_definitions/mcp-server/sources.steps.ts, extensions/pi-claude-marketplace/domain/mcp-resolution.ts, extensions/pi-claude-marketplace/domain/components/mcp.ts
- FOUND commits: a798ddf, 3e18c5d, e121345, 623cffa, afdd266 (5, measured `git rev-list --count 38f3900..HEAD`)
- Acceptance criteria re-run, all PASS:
  - `grep -c 'input.entry.mcpServers ?? input.manifest'` = 0
  - `grep -c 'D-CF6-01'` in mcp-resolution.ts = 6
  - Feature title count = 1
  - `grep -c 'Type.Array'` in mcp.ts = 1
  - plugin.ts diff empty
  - plugin.test.ts hunks limited to the named tests and lists
  - `grep -c 'has no plugin.json'` = 1
  - Scenario count = 6
  - `grep -c 'unsupported mcp'` = 1
  - `npm run test:modules` exit 0

## Dubious Choices

1. **An array with one bad element is refused whole.** The note is the server-map check's message for the first bad element, and no element of that array is read. Alternative: read the valid elements before the bad one. Dubious because upstream refuses the whole manifest at schema time, so no partial-array behavior exists to copy. 06-07 should keep the array refusal fatal, since it is an inline declaration.
2. **`Object.hasOwn(document, "mcpServers")` in place of upstream's `G.mcpServers||G`.** The two differ when `mcpServers` is falsy (`null`, `0`, `""`). Upstream then reads the whole document as the map. Here that file is a malformed map. Dubious as a small divergence on degenerate files. It keeps today's `"mcpServers" in parsed` meaning.
3. **A non-object `.mcp.json` document (`5`, `null`) now gets the note `malformed mcpServers: must be object`.** Before, it got an incidental `malformed mcpServers (.mcp.json): Cannot use 'in' operator ...` note. Both map to `{malformed mcp}`. Dubious only because a note text changed for an edge case.
4. **The bundle case adds no note.** `/claude:plugin info` will not name the bundle file, only `{unsupported mcp}`. Alternative: a note in the resolver's vocabulary. Dubious because a user who reads `info` sees no reason why the plugin is partial.
5. **An absolute or escaping `.mcpb` path is a fatal `malformed mcp reference`, not an unsupported bundle,** because containment runs first. This matches upstream's refusal of such paths.
6. **The no-plugin.json step text differs from the plan** (Deviation 2). Alternative: the plan's exact text, which breaks the layout rule that a phase's steps name their kind.
7. **The comment above the MCPR-01 backstop test was edited** (Deviation 3), just outside the strict `git diff` bound. Alternative: leave a comment that states the opposite of the test.
8. **`[1]` replaces `[]` in the two refused plugin-schema lists.** The plan asked only to remove `[]`. Adding `[1]` keeps "an array holding a number is refused" pinned at the plugin-schema level, inside the lists the criterion allows.
9. **Task 3's four scenarios have no measured red run.** They pin rules that Tasks 1 and 2 shipped. Their red is argued from the old code, not run.
