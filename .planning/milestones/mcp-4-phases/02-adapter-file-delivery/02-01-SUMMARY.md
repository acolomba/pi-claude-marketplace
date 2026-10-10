---
phase: 02-adapter-file-delivery
plan: 01
subsystem: mcp-bridge
tags: [mcp-bridge, jsonc, adapter-file, locations, nfr-10, strip-json-comments]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: pi-mcp-adapter-only detection and the MC-5 marker contract the bridge keeps
provides:
  - bridges/mcp/adapter-doc.ts (JSONC reader, server-key rule, both-key partition, next-doc composer)
  - ScopedLocations.mcpAdapterJsonPath
  - McpConfigFileError typed refusal (filePath, defect; never a cause)
  - MCP stage/unstage retargeted to <scopeRoot>/mcp-adapter.json
  - prune rollback snapshot of mcp-adapter.json (phase label "mcp adapter")
affects: [02-02 nine-source collision walk, 02-03 carry-forward, 02-04 comments-dropped notice, prune catalog]

actuals:
  tokens: 45233
  tasks: 3
  commits: 1
plan_head_before: 52c4db89715eeeabd934636ed7d7f245054fba36
plan_head_after: 341db2586dee79219842ab63862eb5b273b2998b

tech-stack:
  added: [strip-json-comments@^5.0.3 (runtime dependency)]
  patterns:
    - "Read pi-mcp-adapter's file with the adapter's own library and options (grammar by construction)"
    - "Refuse an unreadable shared file with a cause-less typed error; never treat it as empty"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - tests/bridges/mcp/adapter-doc.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - package.json
    - package-lock.json
    - docs/output-catalog.md
    - docs/prd/pi-claude-marketplace-prd.md
    - AGENTS.md
    - .planning/PROJECT.md
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "readMcpConfigDoc takes a non-empty server-key tuple, so the fallback key needs no unreachable branch"
  - "Unstage treats a non-object top level as holding no servers (MC-7 tolerance kept) and refuses invalid JSONC or a non-object server map"
  - "With nothing to stage, an unreadable mcp-adapter.json gives the AS-8 noop with the refusal text as its warning"

patterns-established:
  - "adapter-doc: readMcpConfigDoc -> partitionServers -> withPluginServers; every server-name copy goes through safeSet (WR-01)"

requirements-completed: [AFILE-01, AFILE-02, AFILE-03]

coverage:
  - id: D1
    description: "Install writes the plugin's marked entries into project mcp-adapter.json, keeps foreign keys and creates no mcp.json"
    requirement: AFILE-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#AFILE-01: install writes the plugin's marked entries into project mcp-adapter.json and keeps foreign keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uninstall removes only the plugin's marked entries under both keys and keeps the user server, another plugin's entry and a marker-less stub"
    requirement: AFILE-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/uninstall.test.ts#AFILE-01: uninstall removes only the plugin's marked entries from mcp-adapter.json"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/unstage.test.ts#AFILE-01: removes owned entries under both server keys and keeps a marker-less stub"
        status: pass
    human_judgment: false
  - id: D3
    description: "mcp-adapter.json is parsed with the adapter grammar (BOM, comments, trailing commas); corpus rows also pass a differential check against strip-json-comments"
    requirement: AFILE-02
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-doc.test.ts#readMcpConfigDoc"
        status: pass
    human_judgment: false
  - id: D4
    description: "An MCP install over an unparseable file fails with McpConfigFileError, keeps the bytes, and never shows the file content"
    requirement: AFILE-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#AFILE-02: an MCP install over an unparseable mcp-adapter.json fails and keeps its bytes"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-02: an MCP install over"
        status: pass
    human_judgment: false
  - id: D5
    description: "Entries go under mcp-servers when only that key exists; under mcpServers with stale owned copies removed when both exist"
    requirement: AFILE-03
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-03"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-doc.test.ts#withPluginServers"
        status: pass
    human_judgment: false
  - id: D6
    description: "Prune rollback snapshots mcp-adapter.json beside mcp.json; a changed adapter file stays current with its original in the backup"
    requirement: AFILE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/prune-rollback.test.ts#AFILE-01"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/prune.test.ts#a concurrent MCP edit survives failed save with its original in recovery backup"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-03
status: complete
---

# Phase 2 Plan 01: Adapter-file delivery tracer Summary

**Plugin MCP servers now stage into pi-mcp-adapter's own `<scopeRoot>/mcp-adapter.json`, read with the adapter's `strip-json-comments` grammar; an unreadable file refuses with a cause-less `McpConfigFileError` and keeps its bytes, and the legacy `mcp-servers` key is honored.**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 34 (2 created, 32 modified)

## Accomplishments

- New `bridges/mcp/adapter-doc.ts`: `readMcpConfigDoc` (BOM strip, `strip-json-comments` with `trailingCommas: true`, blank-after-strip is the empty document, four typed refusals), `partitionServers` (owned entries from both keys, selected key wins; foreign entries from the selected key only), `withPluginServers` (drops owned entries from every map, appends new entries after the kept ones, keeps every top-level key in place, never adds an empty server map).
- `prepareStageMcpServers` / commit / replacement / rollback and `unstageMcpServers` target `locations.mcpAdapterJsonPath`. The "treat malformed as empty, then overwrite" branch and its warning are gone.
- `ScopedLocations.mcpAdapterJsonPath`; `mcpJsonPath` stays as the legacy registry in the NFR-10 write set. AGENTS.md, PROJECT.md and the PRD SC-2 / AS-8 / NFR-10 rows name the new file.
- `McpConfigFileError(filePath, defect)` with fixed messages and no `cause`; the `sk-secret-abc` fixture is absent from the error and from the rendered failed install row.
- Prune rollback snapshots `mcp-adapter.json` as phase `mcp adapter` (backup index after `mcp`); the catalog states `rollback-mcp-changed` and `rollback-partial-release-failed` and their fixtures name it.

## Task Commits

All three tasks land in ONE code commit, as the plan requires (moving the bridge and retargeting its tests are one change; either half alone is red):

1. **Tasks 1-3: stage plugin MCP servers into mcp-adapter.json** - `341db258` (feat)

## Verification evidence

- Task 1 verify: typecheck, the five owner tests, the `^AFILE-0` orchestrator cases, and direct coverage at 100% lines/branches/functions for `adapter-doc.ts` (223/53/12), `stage.ts` (361/66/14), `unstage.ts` (79/12/2), `locations.ts` (393/20/8), `errors-bridges.ts` (146/13/12).
- Task 2 verify: typecheck; `test:modules` 7878 pass / 0 fail; `test:architecture` 460 pass / 0 fail (after the two fixes below); `tests/e2e/install-soft-deps.test.ts` 8 pass; `prune-rollback.ts` direct coverage 403/102/19.
- Task 3: `npm run lint:type-members` exits 0; pre-commit over every changed path ends with `PRECOMMIT_EXIT=0`. `npm-check-changed` selected the full scope (`npm run check`, `test:coverage:direct:all`, `test:e2e`), so the e2e suite, including `tests/e2e/adapter-detection-rpc.test.ts`, passed without a change. `fallow audit` verdict: `warn` (not `fail`).
- focused task verification passed; full phase/PR verification pending.

## Context checkpoints

From `tmp/p2-01-checkpoints.log`:

```text
task=1 diff_tokens=27516
task=2 diff_tokens=42675 unexpected_failures=1
```

- Final `actuals.tokens` = 45233 against the 82000 estimate (55%).
- Unexpected retarget failure (outside the Task 2 inventory): `catalog contract matches all 21 fixture modules to 262 exact documented states` (`tests/architecture/catalog-uat/catalog-contract.test.ts`). Its `EXPECTED_UTF8_BYTES` pin counts catalog example bytes; the two renamed child rows add 16 bytes each, so the pin moves 39_968 -> 40_000.

## Dependency audit

`npm view strip-json-comments@5.0.3 scripts` returns only `{ test: 'xo && ava && tsd', bench: 'matcha benchmark.js' }`: no preinstall, install or postinstall script. npm alone wrote the lock entry (integrity `sha512-1tB5mhVo...`). It lands in `dependencies`.

## Remaining legacy `mcpJsonPath` test hits

Every remaining `rg -n "mcpJsonPath" tests` hit is a legacy-file case:

- `tests/persistence/locations.test.ts` (4): the location bundle key list and the expected user/project bundles; `mcpJsonPath` stays in the bundle.
- `tests/orchestrators/plugin/shared.test.ts` (2): the location-bundle projection, now beside `mcpAdapterJsonPath`.
- `tests/orchestrators/plugin/prune-rollback.test.ts` (28): the `mcp` snapshot cases; the legacy file stays in the prune snapshot set.
- `tests/bridges/mcp/stage.test.ts` (2): the ambient-collision case seeds the user's legacy `mcp.json`, which the unchanged four-slot walk still reads; the no-legacy-file case asserts the install creates no `mcp.json`.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only (columns unchanged):

- `bridges/mcp/stage.ts:371:48` -> `:294:48` (filter `:371:22` -> `:294:22`)
- `bridges/mcp/stage.ts:416:42` -> `:341:42` (filter `:416:16` -> `:341:16`)
- `bridges/mcp/stage.ts:49:29` -> `:57:29` (filter `:49:3` -> `:57:3`)
- `bridges/mcp/types.ts:94:52` and `persistence/locations.ts:41:3` did not move.

## Decisions Made

- `readMcpConfigDoc`'s `serverKeys` parameter and `ADAPTER_SERVER_KEYS` are typed as a non-empty tuple (`readonly [McpServerKey, ...McpServerKey[]]`) instead of `readonly McpServerKey[]`. The first key is the fallback, and the tuple type removes an unreachable `?? "mcpServers"` branch that would break 100% direct coverage. Plan 02-02's `PI_MCP_SERVER_KEYS` should use the same tuple type.
- `McpConfigFileError` builds its message from a per-defect lookup table rather than a `switch`, so no unreachable `default` branch is needed.

## Assumptions and carried notes

- AFILE-01 symlink: settled by D-02-16. `write-file-atomic` writes through a symlinked `mcp-adapter.json`, as for `mcp.json`; no real-path check was added (T-02-06 accepted).
- AFILE-02 unstage tolerance: unstage keeps MC-7's tolerance for a non-object top level (no servers, no write) and refuses invalid JSONC and a non-object server map, reading D-02-14's "unstage keeps refusing" as preserving today's unstage contract.
- D-02-17 / collision walk: `assertNoMcpCollisions` still walks the four legacy slots, now with the target path `mcp-adapter.json`. Until plan 02-02 lands the nine-source walk with the same-plugin exemptions (D-02-12, D-02-13, D-02-17), an update of a plugin whose marked entries still sit in a legacy `mcp.json` refuses with a collision. Nothing is released in between (ROADMAP release rule).
- The plan's acceptance check `rg -n "D-02-" extensions/pi-claude-marketplace tests` is not empty, but every hit is pre-existing and cites an older milestone's D-02 IDs (uninstall `--keep-data`, notification types). This plan added none (`git diff <base> | grep '^+.*D-02-'` is empty).
- `tests/e2e/adapter-detection-rpc.test.ts` needed no change (see the pre-commit `test:e2e` result).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Catalog byte-count pin**

- **Found during:** Task 2 (`test:architecture`)
- **Issue:** `catalog-contract.test.ts` pins the total UTF-8 bytes of catalog examples. The renamed `[mcp adapter]` rows and `mcp-adapter.json` causes add 32 bytes.
- **Fix:** `EXPECTED_UTF8_BYTES` 39_968 -> 40_000.
- **Files modified:** `tests/architecture/catalog-uat/catalog-contract.test.ts` (not in the plan's `files_modified`)
- **Commit:** `341db258`

**2. [Sequencing] Contract re-pin moved earlier**

- **Found during:** Task 2 (`test:architecture` runs the real type-member gate)
- **Issue:** the gate exits 2 on the moved `stage.ts` pins, so Task 2's verify could not pass before Task 3's re-pin.
- **Fix:** ran `format:check` and re-pinned the three `stage.ts` contracts during Task 2. Same edit the plan prescribes for Task 3.

**3. [Type shape] Non-empty tuple for server keys** -- see Decisions Made.

## Known Stubs

None. `McpConfigDoc.hadComments` is computed and tested but not yet read by production code; plan 02-04 consumes it for the comments-dropped notice.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Plan 02-02 can build the nine-source walk on `readMcpConfigDoc` / `partitionServers` and add the same-plugin exemptions; plan 02-04 can read `hadComments`.

## Self-Check: PASSED

- Created files exist: `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`, `tests/bridges/mcp/adapter-doc.test.ts`.
- Code commit `341db258` exists on `features/mcp-4` and lists all 33 `files_modified` paths plus `catalog-contract.test.ts`.
