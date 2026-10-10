---
phase: 03-claude-code-tool-names-and-tool-search
plan: 06
subsystem: info
tags: [info, display-name, closed-catalog, mcp]
status: complete

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-01 declared server names in the record and generatedMcpServerKey; 03-04 droppedMcpServers ({ server, feature }) on the resolver's materializable arm"
provides:
  - "mcpServerDisplayName(plugin, server) in domain/name.ts, returning plugin:<plugin>:<server>; generatedMcpServerKey now normalizes its result"
  - "McpServerSummaryEntry ({ name, unsupportedFeature? }) in shared/notification-types.ts; PluginInfoComponentsResolved.components.mcp is an array of it"
  - "appendMcpLine renderer arm: `    mcp: <name>[ (unsupported <feature>)], ...`"
  - "composeMcpEntries in orchestrators/plugin/info.ts, the one module-private composer both info arms use"
  - "Catalog state partially-available-with-unsupported-mcp with its byte-pinned fixture"
affects: [03-09]

actuals:
  tokens: 3844
  tasks: 2
  commits: 1
plan_head_before: 880b007189b791963483cd7a7975744997ac5224
plan_head_after: fb0b06b5de7c30a5a05de1e1a9b644bf5d99a46a

tech-stack:
  added: []
  patterns:
    - "The info command stamps each MCP entry with its Claude name and optional blocking feature; the renderer only formats"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat/fixtures/plugin-info.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/domain/name.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-dispatch.test.ts

key-decisions:
  - "McpServerSummaryEntry.unsupportedFeature is typed string, not McpUnsupportedFeature: shared/ is the leaf layer and cannot import domain/"
  - "mcpServerDisplayName does not screen the plugin name; generatedMcpServerKey still calls assertSafeName before building, so info never throws on a name the key builder would reject"
  - "The record arm passes no dropped servers: the record lists only the servers install wrote"
  - "Sorting uses one extracted comparator, compareComponentNames, shared with sortComponentNames"

patterns-established:
  - "A per-entry info component shape ({ name, tag? }) is formatted by a small module-private renderer arm, like appendHooksBlock"

requirements-completed: [ANAME-01, ANAME-07]

duration: 12min
completed: 2026-10-06
---

# Phase 3 Plan 06: info shows plugin MCP servers by their Claude Code names Summary

**`info` shows each plugin MCP server as `plugin:<plugin>:<server>` on the manifest-backed and installation-record arms, built by `mcpServerDisplayName`, whose string `generatedMcpServerKey` normalizes. A partially available plugin's `mcp:` line names each left-out server with its blocking feature, e.g. `plugin:db-tools:live (unsupported ws)`.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-06T18:28:32Z
- **Completed:** 2026-10-06T18:40:00Z
- **Tasks:** 2
- **Files modified:** 12 (0 created)

## Accomplishments

- `domain/name.ts`: `mcpServerDisplayName(plugin, server)` returns `plugin:<plugin>:<server>`, and `generatedMcpServerKey` normalizes that result. A server name such as `my.api` shows verbatim (`plugin:acme:my.api`), while its key stays `plugin_acme_my_api_`.
- `shared/notification-types.ts`: `McpServerSummaryEntry` with readonly `name` and optional readonly `unsupportedFeature`. `components.mcp` is `readonly McpServerSummaryEntry[]`. Phase 6 can extend this shape with live status.
- `shared/notification-grammar.ts`: `appendResolvedComponentLines` routes the `mcp` kind to the new `appendMcpLine`. It joins entry names with `, ` and appends ` (unsupported <feature>)` to a tagged entry.
- `orchestrators/plugin/info.ts`: `composeMcpEntries(pluginName, servers, dropped = [])` is the one place that calls `mcpServerDisplayName`. `composeResolvedComponents` passes the supported keys and `resolved.droppedMcpServers`, which is now an optional member of its `resolved` parameter type. `composeStateOnlyComponents` gets the plugin name from `buildStateOnlyInstalledRow` and passes `record.resources.mcpServers`. The `requires:` companion check still reads `components.mcp?.length`.
- `docs/output-catalog.md`: the two companion states show `mcp: plugin:commit-commands:github`. The D-96-01 paragraph now says the record keeps each server's declared name, and that info derives the Claude name from it on both arms. The new state `partially-available-with-unsupported-mcp` sits before the multi-scope fan-out states.

## Task Commits

The plan makes one commit, as Task 2 directs:

1. **Task 1 (tracer): both info arms show Claude names, and the ANAME-07 breakdown works end to end.** `fb0b06b5`. Tracer gate: the Task 1 verify (`npm run typecheck`, then `info.test.ts`, 195 pass and 0 fail) was re-run and passed before expanding.
2. **Task 2: renderer and builder tests, catalog amendment.** `fb0b06b5` (feat(info): show plugin MCP servers by their Claude Code names)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

## Verification

- Task 1: `npm run typecheck` clean; `TMPDIR=/var/tmp/mcp4-p3-06 node --test tests/orchestrators/plugin/info.test.ts`: 195 pass, 0 fail.
- Task 2: `TMPDIR=/var/tmp/mcp4-p3-06 npm run test:modules` exit 0; `npm run test:architecture` exit 0 (the catalog contract gate included); `npm run test:integration` exit 0; `npm run test:coverage:direct -- domain/name.ts shared/notification-grammar.ts orchestrators/plugin/info.ts` exit 0 (100% direct coverage).
- PRECOMMIT_EXIT=0 (last line of `tmp/p3-06-precommit.log`, clean on the first pass).
- `npx fallow audit --base 880b0071`: no issues in the 12 changed files; 3 inherited findings excluded.
- Commit hook: `npm run check:commit` Passed for `fb0b06b5`.
- `git diff 880b0071 -- extensions tests | rg '^\+' | rg -c 'D-0[3]-[0-9]{2}'` printed nothing.
- Acceptance greps: one `export function mcpServerDisplayName`; one `mcpServerDisplayName(` call in `info.ts`; `unsupported ws` in `info.test.ts`; the catalog state marker and its fixture; no `mcp: github` and no `raw source keys` in the catalog; `plugin:commit-commands:github` in both companion states.
- Focused task verification passed; full phase/PR verification pending.

## TDD Record (Task 2)

Task 1 is the tracer, and it built the builder, the renderer arm and both info arms before Task 2 wrote their unit rows. So the Task 2 rows (`mcpServerDisplayName` builder rows, the `my.api` key row, and three renderer rows) passed when first run. They pin behavior that already existed. There is no RED evidence for them. The behavior's failing-first evidence is the Task 1 info cases: before Task 1's source changes, the six existing `mcp:` assertions printed bare server names. The plan makes one commit, so there are no separate RED/GREEN commits.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/name.ts`: `mcpServerDisplayName`; `generatedMcpServerKey` builds from it.
- `extensions/pi-claude-marketplace/shared/notification-types.ts`: `McpServerSummaryEntry`; entry-typed `components.mcp`.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`: `appendMcpLine`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: `composeMcpEntries`, `compareComponentNames`, the `droppedMcpServers` parameter member, and the plugin name passed to `composeStateOnlyComponents`.
- `docs/output-catalog.md`, `tests/architecture/catalog-uat/fixtures/plugin-info.ts`: the catalog amendment and fixtures.
- `tests/architecture/catalog-uat/catalog-contract.test.ts`, `catalog-parser.test.ts`: count and byte pins.
- `tests/domain/name.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/shared/notification-grammar.test.ts`, `tests/shared/notification-dispatch.test.ts`: the ANAME-01 and ANAME-07 cases and the moved `mcp` lists.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Catalog gate count and byte pins**
- **Found during:** Task 2 (`npm run test:architecture`)
- **Issue:** `catalog-contract.test.ts` and `catalog-parser.test.ts` pin the documented state count (264) and the total fenced-block bytes (40287). Neither file is in the plan's `files_modified`.
- **Fix:** Moved the pins to 265 states and 40571 bytes. This is the new state's block plus the two longer `mcp:` lines.
- **Files modified:** tests/architecture/catalog-uat/catalog-contract.test.ts, tests/architecture/catalog-uat/catalog-parser.test.ts
- **Committed in:** fb0b06b5

**2. [Rule 1 - Bug] A stale test-file comment**
- **Found during:** Task 1
- **Issue:** The INFO-11 section comment in `info.test.ts` said the record holds the servers' "raw source keys". After this plan, the record holds declared names, and info renders them as Claude names.
- **Fix:** Reworded the comment to match. The new ANAME-01 record-arm case sits under it.
- **Files modified:** tests/orchestrators/plugin/info.test.ts
- **Committed in:** fb0b06b5

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 comment fix). **Impact on plan:** none on scope.

## Issues Encountered

- The record-arm ANAME-01 case first rendered a `skills: alpha-skill` line, because the seed helper defaults the skills resource. The case passes `skills: []` explicitly.
- The `fallow audit` log carries a fallow `WARN` about a `package.json` entry point under `node_modules/.cache`. It is a log line, not a verdict.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-14 is accepted as planned: server names were already printed verbatim on this surface, and the `plugin:<plugin>:` prefix now ties each one to its plugin.

## User Setup Required

None.

## Next Phase Readiness

- Phase 6 can add a live-status field to `McpServerSummaryEntry` and join it to the adapter key through `generatedMcpServerKey`.
- Plan 03-09 can cite `info`'s `plugin:<plugin>:<server>` display in the phase documentation.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/name.ts (`export function mcpServerDisplayName`)
- FOUND: extensions/pi-claude-marketplace/shared/notification-types.ts (`McpServerSummaryEntry`)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (`mcpServerDisplayName(`)
- FOUND: docs/output-catalog.md (`catalog-state: partially-available-with-unsupported-mcp`)
- FOUND: commit fb0b06b5 on HEAD

---
*Phase: 03-claude-code-tool-names-and-tool-search*
*Completed: 2026-10-06*
