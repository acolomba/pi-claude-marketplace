---
phase: 01-companion-floors-and-mcp-defaults
plan: 01
subsystem: companions
tags: [pi-subagents, pi-mcp-adapter, model-mapping, cucumber]
requires: []
provides:
  - Companion peer floors and a shared optional-peer suite version
  - Provider-free mapped agent model IDs
  - Passing conformance and behavioral suites on pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1
affects: [companion compatibility docs, later parity-gaps plans]
actuals:
  tokens: 258630
  tasks: 3
  commits: 3
plan_head_before: b6f418f1dd93471d4906533eda9c4e6c5dfd3ce8
plan_head_after: 4f32ccb69d14215bc7855dd374cabaccdd8ec475
tech-stack:
  added: []
  patterns:
    - One JSON suite-version override for optional peers, validated against declared ranges
    - Companion text projections retain extension-owned values and discard companion wording
key-files:
  created:
    - test/integration/optional-peer-suite-versions.json
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-01-SUMMARY.md
  modified:
    - package.json
    - package-lock.json
    - scripts/install-test-peers.mjs
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - features/lib/upstream/subagents.ts
    - features/agent/frontmatter.feature
    - features/mcp-server/agent-grants.feature
    - test/integration/mcp-adapter-entry-conformance.test.ts
key-decisions:
  - "D-PG1-02: Declare pi-subagents >=0.87.0 while suites run 0.88.0 from one version file."
  - "D-PG1-04: Write bare Claude model IDs without changing the six alias targets."
  - "D-PG1-03: Project pi-subagents 0.88.0's foreground errors to the tool names this extension wrote."
patterns-established:
  - "An optional peer named in the suite-version file must satisfy its declared peer range."
requirements-completed: [PG-AGENT-02, PG-AGENT-07b, PG-MCP-02]
coverage:
  - id: D1
    description: "Peer floors, lockfile, and three readers select the verified suite versions"
    requirement: PG-AGENT-02
    verification:
      - kind: unit
        ref: "test/architecture/peer-floor.test.ts#D-PG1-02 suite version"
        status: pass
      - kind: other
        ref: "p01-01-reader-integration-tracer and p01-01-reader-cucumber-tracer"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mapped agent aliases and full Claude IDs are staged without provider prefixes"
    requirement: PG-AGENT-07b
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts"
        status: pass
      - kind: e2e
        ref: "features/agent/frontmatter.feature#With --map-model Claude Code's model names are listed as the models they select"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both foreground MCP grant scenarios pin pi-subagents 0.88.0's outcome"
    requirement: PG-AGENT-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/agent-grants.feature#A foreground run of an agent granted a plugin MCP tool (adapter and builtin)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Adapter 7.0.1 entry and OAuth conformance checks use its current modules"
    requirement: PG-MCP-02
    verification:
      - kind: integration
        ref: "npm run test:integration"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false
duration: 51 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 01: Companion Floors and MCP Defaults Summary

**Raised the companion peer floors, ran the suites on pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1, and staged bare Claude model IDs.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-11-12T01:39:31Z
- **Completed:** 2026-11-12T02:30:27Z
- **Tasks:** 3
- **Production files changed:** 21
- **Node:** v26.13.0

## Accomplishments

- Raised the manifest and lockfile floors to pi-subagents `>=0.87.0` and pi-mcp-adapter `>=7.0.1 <8`, while all three optional peer readers select pi-subagents 0.88.0 for the suites.
- Removed provider prefixes from mapped agent models without changing the six aliases or rewriting existing installed agents.
- Pinned the mapped model list and both foreground MCP grant scenarios to pi-subagents 0.88.0, and moved the adapter OAuth conformance pin to `dist/utils.js`.
- Passed `npm run check` on the updated cache: 1,799 adapter scenarios, 153 built-in scenarios, and 354 direct coverage records in 530 seconds.

## Task Commits

1. **Peer floors and suite versions:** `ac0817c277fe590c700e4dadad27572e50360c1e` — `build(peers): raise companion floors and pin suite versions` (hook passed).
2. **Bare mapped model IDs:** `947fb931cdf54c093e52904db9a6fd495f9f343d` — `fix(agents): write mapped model IDs without provider prefixes` (hook passed).
3. **Companion output and OAuth conformance:** `4f32ccb69d14215bc7855dd374cabaccdd8ec475` — `test(companions): pin agent output and adapter OAuth imports` (hook passed).

## Measured breaks

| File | Test or scenario | First-run difference | Cause and fix |
| --- | --- | --- | --- |
| `test/integration/mcp-adapter-entry-conformance.test.ts` | Clean non-Authorization header keeps OAuth (D-08-04) | `adapter.authFlow.supportsOAuth is not a function` | pi-mcp-adapter 7.0.1 exports the same predicate from `dist/utils.js`; the test and peer type now load it there. |
| `test/integration/mcp-adapter-entry-conformance.test.ts` | Unset header variable keeps OAuth off (D-08-04) | The same missing-function error | The same module pin correction; both assertions pass. |
| `features/agent/frontmatter.feature` | A run of a mapped-model agent reports the unknown model | Projected `subagent failed: error` instead of naming the model | The old pattern required a provider prefix; it now accepts a bare `claude-` ID at a whole-value boundary. |
| `features/agent/frontmatter.feature` | With `--map-model`, model names are listed as selected models | Bare IDs carried pi-subagents' unavailable-registry marker; expected rows still had provider prefixes | The projection drops that companion-owned marker from model fields; the rows now name bare IDs. |
| `features/mcp-server/agent-grants.feature` | Adapter foreground run of an agent granted a plugin MCP tool | Projected `subagent failed: error`; the child started and reported missing `mcp__plugin_demo_stub__echo` | The projection now recognizes the direct tool name, and the scenario title and row describe the measured failure. The stub request table passed unchanged. |

No break appeared in the static stage, the built-in behavioral profile, direct coverage, or the adapter variable-escape drift guard. The initial unpaired run failed three architecture test processes inside the restricted sandbox without assertion details; the identical command passed with local socket access enabled (71/71), as did the full check. This was an environment gate, not a companion regression.

## Measured texts

The adapter foreground result was captured verbatim before changing the projection:

```text
Run fan-out: 1/64 used, 63 remaining
Agent 'demo:runner' ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable: mcp__plugin_demo_stub__echo.
The `tools` field is a strict allowlist; it does not load extension code.
MCP direct tools missing from the child registry: mcp__plugin_demo_stub__echo.
MCP tools require background children (`async: true`) because only they load ambient extensions.
For extension tools a foreground child can load, add the provider path to `subagentOnlyExtensions` (child-only), `extensions`, or as a path-like entry in `tools`, while keeping each registered tool name in `tools`.

Output artifact: /tmp/pi-cm-features-WgqB8o/home/tmp/pi-subagents-uid-1000/artifacts/9eb215e7-c19d-4e06-9909-36b458e965b4_demo_runner_0_output.md
Mission: 226a274b-bad9-4b99-9296-aca494c4b12c (failed)
```

The built-in foreground result was captured verbatim:

```text
Agent 'demo:runner' selects MCP tools from servers that extensions registered (plugin_demo_stub). Only background children (async: true) load those extensions; run the agent in the background or add the server to the global mcp.json or a trusted project's .pi/mcp.json.
```

The passing adapter tool-result row is `subagent failed: error naming mcp__plugin_demo_stub__echo`. The passing built-in row is `subagent failed: error naming plugin_demo_stub`. Both name a value written by this extension.

The scenario **A foreground agent without a tools list runs without the plugin's MCP tools** lists `pi_claude_marketplace_list, pi_claude_marketplace_plugin_list` on parent calls 1 and 3, and no marketplace tools on child call 2. `features/agent/project-trust.feature` passed unchanged in the full adapter profile; the built-in profile also passed unchanged.

Focused adapter foreground, built-in foreground, and mapped-model list runs took 28, 22, and 23 seconds, respectively, each below the 30-second feedback target. The additional mapped-model error run took 23 seconds. The required full check took 530 seconds under its separate 2,400-second limit.

## pi-mcp-adapter 7.0.1 re-checks

- Registry tarball hashes matched the research record: pi-mcp-adapter 7.0.1 `f4805933bce4c6d2bd732b146a320780e91ed9b8`, pi-subagents 0.88.0 `0b44d0f35a9f8da8033451a5677b4cfff3a53194`.
- `types.ts` retains the `ServerEntry` keys at lines 438–531 and `OAuthConfig` keys at lines 397–422 in the order pinned by `test/bridges/mcp/adapter-entry.test.ts`; neither list changed from 7.0.0.
- `config.ts:1550–1577` keeps server entries and checks no unknown key; `config.ts:1084–1142` and `agent-plugin-provenance.ts:27–36` merge by shallow spread; `metadata-cache.ts:143` and other field consumers read named fields; `config.ts:2005` and `:2292` spread entries on write; `project-server-trust.ts:101–103` hashes the whole entry as identity. These five marker facts still hold; no adapter code applies a special rule to `_piClaudeMarketplace`.
- `test/integration/adapter-expansion-conformance.test.ts` passed unchanged: the variable escape still meets its call-site and interpolation-pass pins.
- The cached adapter's `package.json` declares `@modelcontextprotocol/client` **2.3.1**.

## Lines for later plans

- Compatibility records should say the adapter foreground child starts and then fails because its ambient extension tool `mcp__plugin_demo_stub__echo` is absent. Built-in MCP refuses the foreground child before start and names `plugin_demo_stub`.
- The live background-child tool call remains a later manual check; this plan's foreground scenarios do not assert that a background child can call the tool.
- Documentation should name the declared floors 0.87.0 and 7.0.1, the tested pi-subagents version 0.88.0, and bare mapped model IDs. An installed agent with a qualified ID keeps it until a subsequent `update --map-model`.

## Verification

- Initial stages: `check:static` 0 (14s); `test:unpaired` restricted sandbox 1 (16s), local-socket rerun 0 (19s); `test:integration` 1 (27s); adapter behavioral 1 (340s); built-in behavioral 0 (63s); direct coverage 0 (72s).
- After fixes: `test:integration` 0 (28s); adapter behavioral 0 (324s); all four focused scenarios 1/1 passed; `npm run check` 0 (530s), including both profiles and direct coverage.
- `find ~/.pi -newer /tmp/p01-01-1794447032/p01-01-home-stamp -print` printed no path. The temporary foreground capture write was reverted before the committed projection edit; the committed diff has no filesystem write or import.
- Fallow audit against `b6f418f1dd93471d4906533eda9c4e6c5dfd3ce8` reported no issues in 21 changed files.

## Decisions Made

Followed D-PG1-01 through D-PG1-06. The adapter OAuth predicate's module move required a conformance-only re-pin; no extension behavior changed beyond the requested model output.

## Deviations from Plan

**[Rule 3 - Blocking] Adapter OAuth predicate moved modules.** Found during the first integration stage. pi-mcp-adapter 7.0.1 exports `supportsOAuth` from `dist/utils.js`, while the test typed and loaded it from `dist/mcp-auth-flow.js`. Updated `test/integration/pi-mcp-adapter-peer.ts` and `test/integration/mcp-adapter-entry-conformance.test.ts`. The focused test, full integration stage, and `npm run check` passed. Committed in `4f32ccb69d14215bc7855dd374cabaccdd8ec475`.

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** conformance pin only; no production scope added.

## Issues Encountered

- The first Task 1 commit hook found a TypeScript narrowing error and four lint findings in the new readers. All were fixed and the retry hook passed before `ac0817c2` was created.
- The first full check found one lint rule against a nested conditional in the projection. The branch was simplified, and the complete check then passed.
- The initial unpaired stage lacked local socket access in the restricted sandbox. The escalated rerun passed without changing a test.

## User Setup Required

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All three task commits exist on this branch, the suite-version file exists, both foreground scenarios pass under their own profiles, and the required full check exited 0.

## Post-merge gate

The orchestrator ran `npm run check` on the combined tree at
`60b187de30c14e0008259e9a0835ab7a0bdebdf2`, with Node v26.13.0. It exited 0:
all static checks, unpaired tests, integration tests, 1,799 adapter scenarios,
153 built-in scenarios, and 354 direct coverage records passed. Only planning
Markdown differed from that commit during the gate; no untracked build inputs
were present. The schema-drift gate passed. The codebase-map drift gate reported
an advisory about older map references, with no automatic remap requested.

The executor CLI reported 258,630 tokens; `actuals.tokens` records that total.

## Next Phase Readiness

Ready for 01-02. STATE.md and ROADMAP.md remain owned by the orchestrator; this checkout has no `.claude/gsd-core/bin/gsd-tools.cjs`, so no GSD state mutation was attempted here.
