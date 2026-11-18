---
phase: 09-adapter-entries-and-mcp-features
plan: "03"
subsystem: bridges/mcp adapter entries, domain MCP table, cucumber MCP scenarios
status: complete
tags: [mcp, pi-mcp-adapter, lifecycle, defaults, marker, pi-subagents, cucumber]
requires: [09-01, 09-02]
provides:
  - "`adapterEntryDefaults(server)`: the one table of adapter entry defaults, keyed by the D-PG9-02 transport switch it shares with `defaultRequestTimeoutMs`"
  - "`lifecycle: \"lazy-keep-alive\"` on every stdio plugin entry, recorded in the marker beside the timeout default"
  - "the generalized `defaultFieldsFor`, which writes each default neither the plugin nor the user holds"
affects: [09-04, 09-05, 09-06]
tech-stack:
  added: []
  patterns: [one fixed default table read through a private transport switch]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - test/domain/mcp-server-features.test.ts
    - test/bridges/mcp/adapter-entry.test.ts
    - test/architecture/integration-materialization-gate.test.ts
    - test/bridges/mcp/stage.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/integration/mcp-override-lifecycle.test.ts
    - test/integration/mcp-home-path-partial.test.ts
    - test/integration/mcp-legacy-sweep.test.ts
    - test/integration/mcp-variable-expansion.test.ts
    - features/mcp-server/configuration.feature
    - features/mcp-server/lifecycle.feature
    - features/mcp-server/legacy-move.feature
    - features/plugin/subagent-child.feature
    - features/mcp-server/invocation.feature
    - features/mcp-server/project-scope.feature
    - features/mcp-server/companion-missing.feature
    - features/step_definitions/mcp-server/listing.steps.ts
    - features/step_definitions/mcp-server/verdict-settings.steps.ts
decisions:
  - "A stdio plugin server's adapter entry gets `lifecycle: \"lazy-keep-alive\"` after the plugin's and the user's fields, recorded in `defaultFields`; a remote server gets no lifecycle (D-PG9-01, D-PG9-02)."
  - "The `openUi: false` default of D-PG9-07 is withheld: pi-subagents 0.88.1's `computeMcpServerHash` lacks `openUi`, so an entry with `openUi: false` invalidates the adapter cache for background MCP grants and the agent cannot launch (D-CF6-10). Orchestrator decision, option A, pending maintainer review."
metrics:
  duration: about 165 minutes
  completed: 2026-11-14
requirements: [PG-MCP-06]
actuals:
  tokens: 9900
  tasks: 3
  commits: 4
plan_head_before: 1c58f1a855d1be46874cd98d3992a334bba3aa01
plan_head_after: 6340989efc9f3994be48e4f9afedda377b4fa48f
---

# Phase 9 Plan 03: Stdio Lifecycle Default Summary

Every stdio plugin server's `mcp-adapter.json` entry now holds `lifecycle: "lazy-keep-alive"`.
pi-mcp-adapter keeps the server's startup connection for the session, as Claude Code does.
The marker records the default beside the timeout default. A remote server keeps the
adapter's `lazy`. The `openUi: false` default was written and then withheld, because it
broke pi-subagents' MCP grants (see "Checkpoint and decision"). PG-SEC-03's UI half does not
ship in this plan.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | `581c2f5e` | feat(mcp): keep stdio plugin servers running and withhold the MCP UI |
| 1 (rework) | `7b7bf951` | fix(mcp): withhold the openUi default that breaks agent MCP grants |
| 2 | `99680c6d` | test(mcp): expect the stdio lifecycle default in staged adapter entries |
| 3 | `6340989e` | test(mcp): expect one kept adapter connection for a stdio server |

Every commit passed the full pre-commit hook, `npm run check:commit` included. The root-pin
guard passed before the first edit and before each commit. The title of `581c2f5e` still says
"withhold the MCP UI". `7b7bf951` takes that default back, and no history was rewritten.

## Checkpoint and decision

The first integration run of Task 2 found a regression in
`test/integration/pi-subagents-child-identity.test.ts`, "detached adapter children of a
background agent and an MCP agent hook with their own identity". The agent `demo:granted`
(`tools: mcp__plugin_demo_stub__echo`) never launched: `{"mode":"foreground"}`, with no
state and no session.

I compared three versions of the product, each with this test alone:

| Product | Result |
|---------|--------|
| `1c58f1a8` (no new defaults) | pass |
| `581c2f5e` (lifecycle and `openUi`) | fail |
| HEAD with `openUi` removed, in the working tree only | pass |

Cause, from source:
- pi-mcp-adapter 7.0.1 `metadata-cache.ts` `computeServerHash` hashes
  `...(definition.openUi === false ? { openUi: false } : {})`.
- pi-subagents 0.88.1 `src/runs/shared/mcp-direct-tool-allowlist.js` `computeMcpServerHash`
  copies that hash without `openUi`.
- So pi-subagents reads the adapter's cache as stale, and `child-tool-plan.js:234` throws
  "Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo".
- `lifecycle` is in neither hash.

The orchestrator chose option A, recorded as pending maintainer review. `7b7bf951` drops
`openUi` from the product table and from every expectation. The domain owner case
"D-PG9-07: no transport's defaults hold openUi" carries a comment that names the hash gap.
The child-identity test is the regression guard: it passes on HEAD
(`/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0903-childid-final.txt`,
both children `background`, `complete`).

## Task 1: red and green

**Red, on the unchanged product (`1c58f1a8`):**
- The new `@adapter-only` scenario "An install writes the lifecycle that keeps a stdio
  plugin server for the session, and no lifecycle for a remote server (PG-MCP-06, D-PG9-01,
  D-PG9-02)" failed: 1 scenario (1 failed), 8 of 9 steps passed. The failing step was
  `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text`. The
  diff was only the missing `lifecycle` line and `defaultFields` member of the two stdio entries.
  I measured this red twice: first with the `openUi` text, and again with the final text after
  the rework, against the `1c58f1a8` product files.
- The `@mcp` D-PG1-11 scenario, with the new stdio text, failed at the same step under both
  profiles.
- Owner tests: 44 of 71 failed. `test/domain/mcp-server-features.test.ts` failed to load,
  because `adapterEntryDefaults` did not exist yet. The stamped-entry cases of
  `adapter-entry.test.ts` failed, including the new D-PG9-02 and D-PG9-03 cases.
- The new case "D-PG9-03: the recorded lifecycle default never reaches the restored
  override" also passes on the old code, because `restoredOverride` already reads any field.
  It stays as a guard.

**Green, after the rework:**

| Check | Result |
|-------|--------|
| adapter `--name "keeps a stdio plugin server for the session"` | 1 scenario (1 passed) |
| adapter `--name "written to mcp-adapter.json with the idle window of Claude Code"` | 1 scenario (1 passed) |
| builtin, same name | 1 scenario (1 passed) |
| owner tests plus `integration-materialization-gate.test.ts` | exit 0, 0 failed |
| `test:coverage:direct` for `domain/mcp-server-features.ts`, `bridges/mcp/adapter-entry.ts` | exit 0 |
| `npm run check:features` | exit 0, no "Feature gate failed" |
| `npx tsc --noEmit -p .` and `eslint --max-warnings 0` on the changed TypeScript files | exit 0 |

The following stayed unchanged, so `git diff --stat 1c58f1a8 --` over them prints nothing:
`translateMcpServer`, `CARRIED_FIELDS`, `pluginSetFieldsIn`, `carriedFields`, `marker.ts`,
`mcp-builtin-translation.ts`, and every orchestrator file. `defaultRequestTimeoutMs`
returns what it returned before.

## Task 2: changed expectations

`p0903-addDefaults.py` added the stdio lifecycle to every staged-entry expectation that
records the 1 800 000 ms default. I checked each changed hunk: every one is an expectation or
an "entry a fresh install writes" helper. No input literal changed. Hand edits:
- `mcp-override-lifecycle.test.ts`: the two entries that use `keptMarker`.
- `install-flow-ledger.test.ts` "ANAME-07 / D-08-04": no change was needed for its remote
  entry. Its stdio entry declares `lifecycle: "keep-alive"`, which the closed table drops, and
  it gets the default.

Files whose expectations changed:
- `test/bridges/mcp/stage.test.ts`
- `test/orchestrators/plugin/install-flow-ledger.test.ts`, `update-flow.test.ts`,
  `reinstall-flow.test.ts`, `update-swap.test.ts`
- `test/orchestrators/reconcile/mcp-migration.test.ts`
- `test/integration/mcp-override-lifecycle.test.ts`, `mcp-home-path-partial.test.ts`,
  `mcp-legacy-sweep.test.ts`, `mcp-variable-expansion.test.ts`

These changed nothing, because they hold only remote or non-default entries:
`test/integration/mcp-tool-rules.test.ts`, `adapter-doc.test.ts`, `substitute.test.ts`, and
`test/architecture/mcp-config-notices.test.ts`.

| Check | Result |
|-------|--------|
| the nine candidate unit test files, plus the owner and architecture tests | 1649 tests, 1649 passed, 0 cancelled |
| `npm run test:integration` | exit 0, no failed test, `pi-subagents-child-identity` included |
| `test:coverage:direct -- .../bridges/mcp/stage.ts` | exit 0 |

No case was deleted, skipped, or weakened. The one `-  test(` line in the diff is the retitled
"D-PG1-13 / D-PG9-03: recomputes the recorded stdio defaults when the server becomes remote,
so the lifecycle is gone".

## Task 3: measured scenarios

Discovery run, adapter profile, the 22 files, on `99680c6d`: exit 1, with 201 scenarios (184
passed, 17 failed). These are the same 17 scenarios that 09-01's resident run measured:
- 8 entry texts: lifecycle (4), legacy-move (3), and subagent-child (1).
- 8 stub-message tables: invocation (3), lifecycle (3), configuration `:545`, project-scope
  `:9`, and companion-missing MREC-05.
- 1 status row: companion-missing D-P3-08.

Each table diff removed exactly 3 rows and added none (15 `-` lines, 0 `+` lines). A
pi-subagents child's own connection changed no table: `agent-grants.feature` passed, because
it writes no `openUi`.

Changes:
- **Entry texts:** the lifecycle default in the four D-PG1 texts of `lifecycle.feature`, the
  three of `legacy-move.feature`, and the one stamped text of `subagent-child.feature`. The
  release 0.19.2 scenario's other text is the legacy `mcp.json`, which is not stamped. The
  user-timeout entry gets `lifecycle` and a `defaultFields` that holds only `lifecycle`.
- **Retitled in `lifecycle.feature`:**
  - "A plugin server that changes from stdio to remote in an update gets the remote idle
    window and loses the stdio lifecycle (PG-MCP-01, PG-MCP-06, D-PG1-13, D-PG9-03)"
  - "An entry that release 0.23.0 wrote gets the default timeout and lifecycle at the plugin's
    next reinstall (PG-MCP-01, PG-MCP-06, D-PG1-12, D-PG9-04)"
  - "A disable and an enable write the default timeout and lifecycle again as the extension's
    own (PG-MCP-01, PG-MCP-06, D-PG1-13, D-PG9-04)"
- **Feature description:** now names the lifecycle default (D-PG9-01, D-PG9-03, D-PG9-04)
  and why no `openUi` is written (D-PG9-07, D-CF6-10). The D-PG1-12 scenario's expected text
  now holds the lifecycle default, which plan 09-02 left for this plan.
- **Stub tables:** I removed the second `initialize`, `notifications/initialized`, `tools/list`
  group from each of the nine tables, exactly as the run logged it.
- **Status row:** see `## Status row`.
- **Stale comments:** the `listing.steps.ts` header and the `verdict-settings.steps.ts`
  comment now describe the kept stdio connection.

| Check | Result |
|-------|--------|
| `npm run test:cucumber:profile -- --profile adapter` over the 22 files | exit 0, 201 scenarios (201 passed), 2905 steps |
| `npm run test:cucumber:profile -- --profile builtin` over the 22 files | exit 0, 124 scenarios (124 passed), 1704 steps |
| `npm run check:features` | exit 0 |

No built-in table changed.

## Measured initialize capabilities

These are from the measured run, 2026-11-14, with pi-mcp-adapter 7.0.1 and Pi 1.5.0.

The adapter `initialize` row is unchanged, because no `openUi` is written:

```
{"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}}
```

Pi's built-in MCP is unchanged:

```
{"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}}
```

`server-manager.ts` `buildClientCapabilities` adds the UI extension unless `openUi === false`.
The plan predicted that the UI extension would be gone, but that needs the withheld default.

## Connection reuse

`features/mcp-server/invocation.feature`, "A scripted call through the mcp tool reaches the
plugin's server and returns its result". In both tables, `I` stands for the adapter
`initialize` params above.

Before (a `lazy` entry, listing connection closed):

```
| request      | initialize                | I |
| notification | notifications/initialized |   |
| request      | tools/list                |   |
| request      | initialize                | I |
| notification | notifications/initialized |   |
| request      | tools/list                |   |
| request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}} |
```

After (`lazy-keep-alive`, the startup connection serves the call):

```
| request      | initialize                | I |
| notification | notifications/initialized |   |
| request      | tools/list                |   |
| request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}} |
```

Source: in `init.ts` (around line 403), `resident = (definition.lifecycle ?? "lazy") !== "lazy"`
is true, so the startup pass does not call `manager.close(name)`.

## Status row

`companion-missing.feature` "Plugin info names mcp without the missing tag once pi loads
pi-mcp-adapter (D-P3-08)" now reads `[{"name":"plugin:demo:stub","status":"connected"}]`,
where it read `cached, connects on first use`. This is measured, and it matches 09-01's preview.
Source: pi-mcp-adapter 7.0.1 `mcp-status.ts` around line 46, `connection?.status ===
"connected"` → `status = "connected"`. The resident connection is open when info runs.

## Lines for later plans

- **Commands that restage an entry and write the lifecycle default:**
  - `install`
  - `update` to a new revision
  - `reinstall`
  - `enable`
  - an `apply` that enables a plugin or moves it to a new revision
  - `import`
  - the AMIG-01 legacy move at a load: `legacy-move.feature` and `subagent-child.feature`
    show it, and it is the only load-time writer (APL-D1)
- `update` at an unchanged version does not restage, so it does not add the default.
- Project approval: pi-mcp-adapter 7.0.1 `project-server-trust.ts`
  `hashProjectServerDefinition` (around lines 95-110) hashes the whole canonical definition,
  so a project server approved before its restage asks for approval once more. I read this
  in the source and did not measure it.
- Relist: `lifecycle` is not in `computeServerHash` (`metadata-cache.ts` excludes it), so this
  default causes no relist. An `openUi: false` default would have caused a one-time relist,
  and it is also why pi-subagents breaks.
- A user's `lifecycle` on an entry wins and is not recorded (D-PG9-03; owner cases here, the
  update scenario is plan 09-04).

## Deviations from Plan

1. **[Rule 4, orchestrator option A] `openUi: false` withheld** (`7b7bf951`). The plan's
   must-haves for `openUi`, PG-SEC-03's UI half, and T-09-09 are not met. These acceptance
   criteria were dropped or changed:
   - zero `io.modelcontextprotocol/ui` rows in seven feature files: there are still 12
     `initialize` rows that hold it;
   - `"openUi": false` at least 12 times in `configuration.feature`, at least 6 times in
     `legacy-move.feature`, and at least 2 times in `subagent-child.feature`: it is now 0
     everywhere.

   The new scenario's title no longer names PG-SEC-03 or D-PG9-07.
2. **[Rule 1] Expectation fix in `mcp-override-lifecycle.test.ts`.** My transform first gave
   an entry with a stored `openUi: true` choice a second `openUi` key. The final text keeps the
   user's `openUi: true`, and only `lifecycle` is a default.
3. **One commit more than planned.** It is the forward rework commit, and it was not amended.
4. **The two stale comments were fixed in the Task 3 commit**, as the orchestrator asked.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- **Mitigated as planned:**
  - T-09-07: a default fills only a field that neither the translated nor the carried fields
    hold, with owner cases for user values, recorded defaults, and a type mismatch.
  - T-09-08: the closed table is unchanged, and the domain case proves that it writes neither
    `lifecycle` nor `openUi`.
  - T-09-11: no orchestrator changed.
  - T-09-13: the project approval effect is recorded above.
- **Not mitigated:** T-09-09 (the MCP Apps UI extension is still declared). It is withheld by
  decision, and its divergence and upstream gap are listed below for 09-05 and 09-06.
- **Accepted:** T-09-10 (sampling) is unchanged.

## Parent-owned lines requested

- **CONTEXT.md and 09-VALIDATION.md, D-PG9-07 amendment:** "openUi default withheld:
  pi-subagents 0.88.1's computeMcpServerHash lacks openUi, so an entry with openUi:false
  invalidates the adapter cache for background MCP grants (D-CF6-10); Pi-companion capability
  gap; pending maintainer review." 09-VALIDATION should name
  `pi-subagents-child-identity.test.ts` "detached adapter children …" as the regression guard,
  and the domain case "D-PG9-07: no transport's defaults hold openUi".
- **BACKLOG:** bring the `openUi: false` default back once the pi-subagents floor includes
  `openUi` in `computeMcpServerHash`, as pi-mcp-adapter 7.0.1's `computeServerHash` does. The
  maintainer files the upstream pi-subagents request; nothing was filed upstream from this run.
- **09-05 and 09-06 docs plans, divergence row:** the MCP Apps UI extension is still declared
  to plugin servers under pi-mcp-adapter, which differs from Claude Code 2.1.323 in a CLI
  session. Cause: the pi-subagents 0.88.1 hash gap (D-PG9-07 amendment). The row sits beside
  the sampling row of D-PG9-08.
- **REQUIREMENTS.md:** PG-MCP-06 has its product default and unit cases; the user-lifecycle
  update scenario is plan 09-04. PG-SEC-03 stays open: its UI half is withheld and its
  sampling half is a divergence.
- **STATE.md and ROADMAP.md:** plan 09-03 is complete, with 3 tasks and 4 commits. The decision
  lines are the two `decisions` entries in this frontmatter.

## Self-Check: PASSED

- FOUND: every modified file in `key-files`.
- FOUND: `581c2f5e`, `7b7bf951`, `99680c6d`, and `6340989e` are ancestors of HEAD.
  `git rev-list --count 1c58f1a8..HEAD` is 4.
