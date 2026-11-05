---
phase: 03-read-time-verdicts
plan: "03"
subsystem: plugin-info-fetch
tags: [mcp, info, fetch, mcp-builtin, read-time-verdict, neutral-compatibility]

requires:
  - phase: 03-read-time-verdicts
    provides: "resolutionFor (domain/plugin-resolver.ts) and readRecordMcpVerdict (orchestrators/plugin/mcp-verdict-read.ts) from plan 03-01"
provides:
  - "info reads every resolution through resolutionFor with run.softDeps.mcpImplementation: written servers are the declared ones the view does not leave out, left-out servers carry the active implementation's feature token (MREC-04)"
  - "info reads each installation record once per block through readRecordMcpVerdict: record-only, non-path, and invalid-manifest rows take the effective unsupported kinds; record-only rows write the recorded servers the effective verdict does not block (D-P3-05)"
  - "fetch builds each resolved row from resolutionFor with the run's implementation (P3-DC-25)"
  - "invalid-configs.feature: four @mcp malformed-verdict rows and two named @adapter-only scenarios (D-P3-18)"
  - "features/lib/mcp-verdict-git.ts pushPluginFile: a new git plugin revision that writes one file inside the plugin directory"
affects: [03-08]

actuals:
  tokens: 16912
  tasks: 2
  commits: 2
plan_head_before: a656803c7111fd4090c46068ca74b5e1338cf66d
plan_head_after: 43bc08d05f752af29f7821a02dc94b3a7d17d505

tech-stack:
  added: []
  patterns:
    - "One InstalledRecordView (record plus its effective MCP verdict) per info block, read before any sync row helper needs it"
    - "composeResolvedComponents takes the view's declaredMcpServers and droppedMcpServers; the lenient arms pass declaredMcpServers: {}"

key-files:
  created:
    - features/mcp-server/verdict-info.feature
    - features/mcp-server/verdict-fetch.feature
    - features/step_definitions/mcp-server/verdict-fetch.steps.ts
    - features/lib/mcp-verdict-git.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - features/mcp-server/invalid-configs.feature

key-decisions:
  - "The record verdict is read once per block in buildBlock (readInstalledRecord) and passed down as InstalledRecordView; buildNonPathInstalledRow, buildInstalledRow, and buildInstalledGitRow take the effective unsupported list instead of the record"
  - "A warm git installed row whose view is partially-available keeps today's D-78-04 arm (recorded status, components not resolved), now with the effective status"
  - "The record-only mcp line falls back to the staged names with no left-out list only when the recorded servers are unreadable (frozen rule 1)"

patterns-established:
  - "Every info and fetch resolution passes the run's implementation explicitly; no default"

requirements-completed: [MREC-03, MREC-04]

coverage:
  - id: D1
    description: "info written and left-out servers per implementation (sse, bare elicitation, ws, no MCP) for installed and not-installed path rows"
    requirement: MREC-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#MREC-04 / D-P3-05: under builtin an installed plugin's sse server reads for that implementation"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-info.feature (adapter and builtin profiles)"
        status: pass
    human_judgment: false
  - id: D2
    description: "record-backed info rows (record-only, non-path) read the effective verdict; unreadable keeps the stored verdict"
    requirement: MREC-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#MREC-04 / D-P3-05: under builtin a record-only row reads the neutral record's servers for that implementation"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#MREC-02: a record-only row whose servers cannot be read keeps its stored status and staged names"
        status: pass
    human_judgment: false
  - id: D3
    description: "fetch rows follow the active implementation"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/fetch.test.ts#P3-DC-25: under builtin a fetched sse-only plugin reads for that implementation"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-fetch.feature (adapter and builtin profiles)"
        status: pass
    human_judgment: false
  - id: D4
    description: "malformed verdict rows run under both profiles"
    requirement: MREC-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/invalid-configs.feature (builtin: 4 @mcp scenarios; adapter: all 9 rows)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 03: info and fetch verdicts for the active implementation Summary

**`info` now lists each MCP server as written or left out for the MCP implementation Pi runs, with that implementation's feature token (`(unsupported sse)` under Pi's built-in MCP, `(unsupported bareElicitationCapability)` under pi-mcp-adapter), its status rows follow the effective record verdict with no reinstall, and `fetch` rows follow the same implementation.**

## Performance

- **Duration:** about 75 min
- **Completed:** 2026-11-04
- **Tasks:** 2 of 2
- **Files:** 9 (4 created, 5 modified)

## Accomplishments

- `info.ts`: the four `resolveStrict` sites (installed git, installed path, not-installed git, not-installed path) read the result through `resolutionFor(…, mcpImplementation)` before any `state`, `unsupported`, or `droppedMcpServers` read. `buildBlock` takes the run's implementation from `getPluginInfoWithReader` and threads it to every row builder.
- `composeResolvedComponents` takes `declaredMcpServers` and the view's `droppedMcpServers`. A new `writtenMcpServers` helper gives the declared servers the view does not leave out, in declared order, with their configs for the variable scans. The output order stays `composeMcpEntries`' name sort, so each server shows once, written or left out.
- Record-backed rows: `readInstalledRecord` reads `readRecordMcpVerdict` once per block. `derivePersistedInstalledStatus` takes the effective `unsupported`; `buildStateOnlyInstalledRow`, `invalidManifestBlock`, `buildNonPathInstalledRow`, and the git installed fallback use it. A new `stateOnlyMcpEntries` writes the recorded servers the effective `blocked` list does not name and leaves out the blocked ones with their feature, and falls back to `resources.mcpServers` with no left-out list when the read is `unreadable`.
- `withServerStatus` and `withCompanionRequirements` are untouched. `git diff a656803..HEAD -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` has no hunk inside either function; the two hunks after line 3360 are the `mcpImplementation` field of the two `buildBlock` calls in `getPluginInfoWithReader`.
- `fetch.ts`: `freshRow` takes the run's implementation and passes `resolutionFor(candidate.resolved, …)` to `resolvedRow` (P3-DC-25).
- `verdict-info.feature` (4 scenarios), `verdict-fetch.feature` (2 scenarios) with `verdict-fetch.steps.ts` and `features/lib/mcp-verdict-git.ts`, and the retagged `invalid-configs.feature`.

## Task Commits

1. **Task 1: info shows each server's verdict and the effective state for the active implementation** - `1d8df9a` (feat)
2. **Task 2: fetch rows follow the active implementation; malformed rows run under both profiles** - `43bc08d` (feat)

## Red proof per profile (cucumber)

Each new scenario ran with the product file of its task restored to the plan's base commit `a656803`.

| Scenario | Profile | On the base commit | Observed |
|---|---|---|---|
| Plugin info shows an sse server as left out, under Pi's built-in MCP (MREC-04) | builtin | failed | `plugin components mcp` read `[{"name":"plugin:demo:events","status":"status unknown"},{"name":"plugin:demo:tools","status":"status unknown"}]`, `plugin status` `installed`, `plugin reasons` empty |
| Plugin info shows a plugin with an sse server as partially available, under Pi's built-in MCP (MREC-04) | builtin | failed | `plugin components mcp` read both servers written, `plugin status` `available`, `plugin reasons` empty |
| Plugin info shows an sse server as written, under pi-mcp-adapter (MREC-04) | adapter | passed | Guard: the adapter already runs sse, so the base already wrote both servers. It protects the adapter row. |
| Plugin info shows a plugin with an sse server as available, under pi-mcp-adapter (MREC-04) | adapter | passed | Guard, same reason. |
| Fetching a plugin whose new revision declares an sse server reports it partially available, under Pi's built-in MCP (P3-DC-25) | builtin | failed | `Then the result lists these plugins:` read `available` with no reasons |
| Fetching a plugin whose new revision declares an sse server reports it available, under pi-mcp-adapter (P3-DC-25) | adapter | passed | Guard: the base fetch row read the neutral verdict, which runs sse. |
| invalid-configs.feature, the four retagged `@mcp` scenarios | builtin | passed (no product change) | Guards: malformed is one shared shape check (D-P3-18), so the rows already held under Pi's built-in MCP. |

GREEN after the change: builtin `features/mcp-server/verdict-info.feature` 2/2; adapter `verdict-info.feature` plus `features/plugin/info.feature` 17/17; builtin `verdict-fetch.feature` plus `invalid-configs.feature` 5/5; adapter `verdict-fetch.feature`, `invalid-configs.feature`, and `features/plugin/fetch.feature` 21/21.

## TDD RED evidence (unit)

The commit hook refuses a failing-test-only commit, so each task committed tests and implementation together (P1-DC-28). RED was taken by restoring the task's product file to `a656803` and running the new cases with `node --test --test-reporter=tap --test-name-pattern=…` under the non-DAC wrapper.

- **Task 1** (`info.ts` at base), 18 new cases: 6 failed on their assertions, 12 passed as guards.
  - `not ok 1 - MREC-04 / D-P3-05: under builtin an installed plugin's sse server reads for that implementation`: actual `● alpha v1.0.0 (installed)` with `mcp: plugin:alpha:events, plugin:alpha:stub`; expected `(partially-installed) {unsupported mcp}` with `plugin:alpha:events (unsupported sse)`.
  - `not ok 4 - MREC-04: under adapter a server with a bare elicitation capability reads for that implementation`: actual `○ alpha v1.0.0 (available)` with no `mcp:` line at all (the neutral record dropped the server from both lists); expected `(partially-available) {unsupported mcp}` with `plugin:alpha:ask (unsupported bareElicitationCapability)`.
  - `not ok 5 - … under builtin a server with a bare elicitation capability …`: actual no `mcp:` line; expected `mcp: plugin:alpha:ask` written.
  - `not ok 12 - MREC-04: under builtin a not-installed sse plugin reads for that implementation`: actual `(available)` with the server written.
  - `not ok 14 - D-P3-05: under builtin a non-path row reads the neutral record's status …`: actual `● alpha v1.0.0 (installed)`.
  - `not ok 16 - MREC-04 / D-P3-05: under builtin a record-only row reads the neutral record's servers …`: actual `(installed) {not in manifest}` with both servers written.
  - Guards (pass on base): the adapter and none installed cases, the three ws cases, the three no-MCP cases, the adapter not-installed sse case, the adapter non-path and record-only cases, and the MREC-02 unreadable case.
  - Semantic assessment: each failure is the target case failing on its planned row assertion, with the base output the old neutral or adapter verdict; no load, syntax, or fixture fault.
- **Task 2** (`fetch.ts` at base), 3 new cases: `not ok 3 - P3-DC-25: under builtin a fetched sse-only plugin reads for that implementation` (actual `○ events v1.0.0 (available)`, expected `⊖ … (partially-available) {unsupported mcp}`); the adapter and none cases passed as guards.

## Verification

- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: exit 0 (100% direct coverage).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`: exit 0.
- `npm run check:static`: exit 0 after each task (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Neighbouring tests: `test/edge/handlers/plugin/info.test.ts`, `test/orchestrators/plugin/operations.test.ts`, and the three integration files that run `info` (`mcp-migration`, `project-install-adds-user-marketplace`, `reserved-record-keys`): pass.
- Cucumber: as listed under the red proof.
- Acceptance greps: `resolutionFor` in info.ts 5, `readRecordMcpVerdict` in info.ts 4, `resolutionFor` in fetch.ts 2; `head -1 features/mcp-server/invalid-configs.feature` prints `Feature: MCP server invalid configs`; `grep -c "@mcp" features/mcp-server/invalid-configs.feature` prints 4.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - view-based resolutions, the per-block record verdict, record-only server lines
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` - resolved rows on the run's view
- `test/orchestrators/plugin/info.test.ts` - 18 MREC-04 / D-P3-05 / MREC-02 cases
- `test/orchestrators/plugin/fetch.test.ts` - 3 P3-DC-25 cases
- `features/mcp-server/verdict-info.feature` - the installed and not-installed sse pairs
- `features/mcp-server/verdict-fetch.feature` - the fetch pair
- `features/step_definitions/mcp-server/verdict-fetch.steps.ts` - `the git repository {string} adds this .mcp.json to the plugin {string}:`
- `features/lib/mcp-verdict-git.ts` - `pushPluginFile`, which refuses a path outside the plugin directory (T-03-08)
- `features/mcp-server/invalid-configs.feature` - feature tag removed, four `@mcp`, two `@adapter-only` with the D-CF6-02 / BLT-01 license in the description

## Decisions Made

See `key-decisions` above; each is also listed under Dubious Choices.

## Deviations from Plan

None that changed behavior. Two notes:

- The unit cases seed the neutral record by rewriting `state.json` in a local test helper (`recordNeutralVerdict`), because the shared seed in `test/edge/handlers/marketplace-seed.ts` is outside this plan's files.
- Temp files went to the scratch folder the dispatch named (`…/scratchpad/p3/exec-03/`), not the plan's `…/scratchpad/03-03/`.

## Issues Encountered

- **The built-in status of a written server can change when Phase 2 merges.** `verdict-info.feature`'s built-in installed scenario pins the stub's runtime status as `status unknown`, which is what the built-in status reader reports today. If Phase 2's registration makes it report something else, the post-merge gate shows it in that one cell. The adapter twin and the left-out `events` entry carry no such risk.
- **`requires:` rows stay as today.** Both info pairs pin `plugin requires` as `withCompanionRequirements` computes it now (`pi-mcp-adapter`, missing under built-in); plan 03-08 owns that line and its plan already expects these cells to stay.

## User Setup Required

None.

## Next Phase Readiness

Plan 03-08 can build the `requires:` line on top of the written/left-out entries info now produces under each implementation.

## Parent line candidates

- CHANGELOG: "`/claude:plugin info` shows each MCP server as written or left out for the MCP implementation Pi runs (pi-mcp-adapter or Pi's built-in MCP), with the feature that blocks it, and `info` and `fetch` show the plugin's state for that implementation."

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. info reads records only through `readRecordMcpVerdict` and fresh resolutions only through `resolutionFor` (T-03-06; no new git import, fallow and ESLint BLOCK F pass); left-out entries carry `unsupportedFeature`, which the frozen status pass skips (T-03-07); `pushPluginFile` refuses a path outside the plugin directory and writes only in the scenario's repository (T-03-08); no package was added (T-03-SC).

## Dubious Choices

- **A warm git installed plugin whose view is partially available shows `components: not resolved`.** Severity: Medium. Under Pi's built-in MCP, an installed github plugin with an sse server now reads `(partially-installed) {unsupported mcp}` with no component lines, where the base showed every component (as `installed`). The path-source arm enumerates components for a partially-available view; the git arm keeps the D-78-04 recorded-row fallback it already used for any non-installable warm resolve (such as `lspServers`). Alternative: enumerate the warm tree's components for a partially-available view, as `buildWarmGitNonInstallableRow` does for not-installed rows, which would also change today's `lspServers` git rows. Why dubious: MREC-04 says info lists every server of a resolved plugin, and a git plugin under built-in loses its server lines.
- **The record verdict is read for every installed block, including path rows that resolve fresh.** Severity: Low. For a legacy record with an MCP trace this costs one extra offline `resolveStrict`. Alternative: read it lazily in the three record-backed arms, which spreads `await` and narrowing through `buildBlock`. Why dubious: wasted work on the common path.
- **A record whose recorded configs include a malformed one writes every recorded server.** Severity: Low. The frozen effective read returns the stored verdict and no blocked servers in that case, and the record-only line writes all recorded names instead of falling back to the staged names. Install never records a malformed server, so only a hand-edited record reaches it. Alternative: also fall back to staged names when the stored verdict stands for a malformed config (needs the shape check in info.ts). Why dubious: rule 1 says the stored verdict stands, and the staged names are the stored view.
- **The built-in info scenario pins a written server's `status unknown`.** Severity: Low. Alternative: drop the stub and declare only the sse server, which leaves the built-in scenario with no written server to compare. Why dubious: Phase 2's merge may change that cell (see Issues Encountered).
- **The unit cases seed the neutral record by rewriting `state.json` in the test file.** Severity: Low. Alternative: extend the shared `buildInstalledPluginRecord` seed, which is outside this plan's files. Why dubious: a local JSON edit duplicates record shape knowledge.
- **Commit trailers use the parent session id `session_01EDUMG7S9uXh4o5dikBwum8`.** Severity: Low. The harness reminder named `session_01EDUMG5p4jHecGXqAFGi3Do`; the child-session brief and the executor instructions name the parent's id "exactly". Why dubious: two sources disagree.

## Self-Check: PASSED

- FOUND: features/mcp-server/verdict-info.feature
- FOUND: features/mcp-server/verdict-fetch.feature
- FOUND: features/step_definitions/mcp-server/verdict-fetch.steps.ts
- FOUND: features/lib/mcp-verdict-git.ts
- FOUND: 1d8df9a, 43bc08d (ancestors of HEAD)

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*
