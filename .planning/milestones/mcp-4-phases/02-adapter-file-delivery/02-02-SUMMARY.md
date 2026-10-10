---
phase: 02-adapter-file-delivery
plan: 02
subsystem: mcp-bridge
tags: [mcp-bridge, collision, precedence, pi-mcp-adapter-5, legacy-sweep]

requires:
  - phase: 02-adapter-file-delivery
    provides: adapter-doc reader (readMcpConfigDoc, partitionServers, withPluginServers), McpConfigFileError, mcpAdapterJsonPath (plan 02-01)
provides:
  - bridges/mcp/collision-slots.ts walkMcpSources (nine sources, later wins, full definitions only)
  - bridges/mcp/collision-ancestors.ts ancestorSourcePaths (settings.ancestorConfigRoots trust rules)
  - adapter-doc isFullDefinition, PI_MCP_SERVER_KEYS, McpServerPartition.overlays
  - McpServerCollisionError.winningPath and the three-argument constructor
  - unstage sweep of the plugin's marked entries in the same scope's legacy mcp.json
affects: [02-03 carry-forward (overlays bucket), 02-04 comments-dropped notice, Phase 5 legacy migration]

actuals:
  tokens: 31562
  tasks: 3
  commits: 1
plan_head_before: f1ca80d1d4367b6668caa2006bc865603627c529
plan_head_after: 6bded229ac8d90185fbd4235c4b74326d545e6f5

tech-stack:
  added: []
  patterns:
    - "Read the adapter's config sources in its own precedence order; the declarer list keeps source order so the last entry is the winner"
    - "Exempt the plugin's own marked entries by marker, whichever source holds them"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts
    - tests/bridges/mcp/collision-ancestors.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - tests/bridges/mcp/collision-slots.test.ts
    - tests/bridges/mcp/adapter-doc.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts
    - tests/shared/errors-bridges.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - docs/prd/pi-claude-marketplace-prd.md
    - .planning/BACKLOG.md
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "Ancestor roots follow the adapter 5.0.0 source: only a `~/` prefix expands, so a bare `~` entry is not absolute and is skipped; the deeper-root case uses the absolute home path"
  - "A cwd or home directory that does not resolve through realpath stays lexical, as the adapter's getConfigPathIdentity does"
  - "Ancestor paths are listed whether or not the files exist; a missing ancestor file reads as the empty document and declares nothing"
  - "Overlays are dropped only from the selected server key when a staged entry replaces them; the key the adapter does not load keeps them"

patterns-established:
  - "walkMcpSources -> otherDeclarers (same-owner filter) -> highest precedence index names owner and winner"

requirements-completed: [AFILE-05, AFILE-01]

coverage:
  - id: D1
    description: "The walk lists pi-mcp-adapter 5's sources in its precedence order, and a name declared in several sources lists them lowest first"
    requirement: AFILE-05
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/collision-slots.test.ts#AFILE-05: lists the fixed sources in adapter precedence order"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/collision-slots.test.ts#AFILE-05: lists a name declared in several sources lowest precedence first"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only full definitions declare; partial entries, Pi-format mcp-servers, bare maps and unreadable foreign files contribute nothing; EACCES propagates"
    requirement: AFILE-05
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/collision-slots.test.ts#AFILE-05: a partial entry with no transport never declares a server"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-doc.test.ts#isFullDefinition"
        status: pass
    human_judgment: false
  - id: D3
    description: "A collision refuses with owningPath and winningPath; an install refuses a server ~/.agents/mcp.json defines and names both files in the cause line"
    requirement: AFILE-05
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-05: a full definition in ~/.agents/mcp.json refuses a user-scope install"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/install-flow.test.ts#AFILE-05: install refuses a server ~/.agents/mcp.json already defines and names the file the adapter would load"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ancestor sources follow settings.ancestorConfigRoots from user-global adapter-format sources only, last setter wins, deepest valid root wins"
    requirement: AFILE-05
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/collision-ancestors.test.ts"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/collision-slots.test.ts#AFILE-05: ignores ancestorConfigRoots set in a project file or a Pi-format mcp.json"
        status: pass
    human_judgment: false
  - id: D5
    description: "The plugin's own marked entries never refuse its install or update in any source: same-scope legacy mcp.json, other scope's mcp-adapter.json and mcp.json, an ancestor mcp-adapter.json"
    requirement: AFILE-05
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-05: the plugin's own entry in"
        status: pass
    human_judgment: false
  - id: D6
    description: "Unstage removes the plugin's marked entries from the same scope's legacy mcp.json, reads both files before writing either, and refuses before any write on an unparseable file"
    requirement: AFILE-01
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/unstage.test.ts#AFILE-01"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/uninstall.test.ts#AFILE-01: uninstall also removes the plugin's legacy mcp.json entries"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-10-03
status: complete
---

# Phase 2 Plan 02: Nine-source collision walk Summary

**The MCP collision check now walks pi-mcp-adapter 5's nine config sources in its later-wins order, counts only full definitions, names the source the adapter would load, never counts the plugin's own marked entries, and uninstall sweeps the plugin's legacy `mcp.json` entries.**

## Performance

- **Duration:** about 27 min
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 18 (2 created, 16 modified)

## Accomplishments

- `collision-slots.ts` is rewritten around `walkMcpSources(cwd)`. It returns every source path in adapter order (`~/.config/mcp/mcp.json`, `~/.agents/mcp.json`, `~/.agents/mcp/mcp.json`, `<agentDir>/mcp.json`, `<agentDir>/mcp-adapter.json`, ancestors, `<cwd>/.mcp.json`, `<cwd>/.pi/mcp.json`, `<cwd>/.pi/mcp-adapter.json`) and every full definition per name in source order. The header carries the out-of-contract list. The four-slot map and the unwrapped-form tolerance are gone.
- New `collision-ancestors.ts`: `ancestorSourcePaths(cwd, configuredRoots)` implements the adapter's `getConfiguredAncestorRoot` and `getAncestorProjectDirs` rules (read from the 5.0.0 tarball). The walk reads the setting from adapter-format user-global sources only (1, 2, 3, 5), the last setter winning, and skips an ancestor path that is already a global source.
- `adapter-doc.ts`: `isFullDefinition`, `PI_MCP_SERVER_KEYS` (non-empty tuple, as the 02-01 handoff asked), and the `overlays` bucket on `McpServerPartition`. `withPluginServers` drops an overlay under a staged name from the selected key, so the staged entry replaces it after the kept entries.
- `McpServerCollisionError(serverName, owningPath, winningPath)` with the message `Refusing to stage MCP server "<name>": <owningPath> already defines it, and pi-mcp-adapter would load the definition in <winningPath>.`
- `assertNoMcpCollisions` walks once per stage, filters same-owner marked entries from every source, adds the target when a foreign entry there holds the name, and names the highest-precedence declarer as owner and the higher of owner and target as winner.
- `unstageMcpServers` reads `mcp-adapter.json` and the legacy `mcp.json` (`mcpServers` only) before writing either, writes the adapter file first, rewrites a file only when an entry left it, and lists the adapter names first.
- PRD MC-4 states the nine-source, later-wins, full-definition contract and the out-of-contract sources; RN-5 says "nine sources". BACKLOG MCPSRC-01 is closed.

## Task Commits

All three tasks land in ONE code commit, as the plan requires:

1. **Tasks 1-3: check collisions across the adapter's nine sources** - `6bded229` (feat)

## Verification evidence

- Task 1 verify (`tmp/p2-02-t1-verify.log`, `VERIFY_EXIT=0`): typecheck; owner tests 121 + 19 + 46 + 12 + 44 pass; the `^AFILE-05` install-flow case passes (pass 1); direct coverage 100% for `errors-bridges.ts` (13/12/151), `adapter-doc.ts`, `collision-slots.ts`, `stage.ts` (74/19/402).
- Tracer gate after Task 1: interactive mode, `end-of-phase` human verify, automated-only verify re-run and passed, so expansion continued.
- Task 2 verify (`tmp/p2-02-t2-verify.log`, `VERIFY_EXIT=0`): 75 pass; direct coverage `collision-ancestors.ts` 36/8/111, `collision-slots.ts` 40/16/186.
- Task 3 verify (`tmp/p2-02-t3-verify.log`, `VERIFY_EXIT=0`): unstage 26 pass; `^AFILE-01` uninstall 2 pass; direct coverage at 100% for all six changed production modules (final: `adapter-doc.ts` 69/16/287, `collision-ancestors.ts` 36/8/112, `collision-slots.ts` 40/16/185, `stage.ts` 74/19/402, `unstage.ts` 17/4/104, `errors-bridges.ts` 13/12/151); `lint:type-members` exit 0.
- Wider check: `update-flow`, `reinstall-flow`, `install-flow` and `uninstall` suites, 646 pass / 0 fail. ESLint on every changed file exits 0. `fallow audit` verdict `warn` (not `fail`); its two `introduced` clone groups sit in `tests/architecture/catalog-uat/fixtures/plugin-info.ts`, which this plan does not touch.
- Pre-commit over all 18 code paths plus this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md: the first run ended `PRECOMMIT_EXIT=1` because mdformat re-padded the PRD table; the re-run logged `PRECOMMIT_EXIT=0` (`tmp/p2-02-precommit.log`), with `npm changed checks` passing.
- focused task verification passed; full phase/PR verification pending.

## TDD (Task 2)

RED: a stub `ancestorSourcePaths` returning `[]`, then the new tests. 12 assertion failures across `collision-ancestors.test.ts` and the walk rows (`tmp/p2-02-red.log`). The RED record `tmp/p2-02-red-evidence.json` (target `AFILE-05: lists two files per directory from the root down to the parent of cwd, farthest first`) returns `RED_EVIDENCE_OK` / `target_test_failed` from `gsd-tools check tdd-red-evidence`. GREEN: 75 pass. The plan's single-commit protocol replaces the per-gate `test(...)`/`feat(...)` commits, as the orchestrator instructed; the plan type is `execute`, so no gate-commit check applies.

## Complexity (both gates)

| Function | ESLint `sonarjs/cognitive-complexity` | fallow cyclomatic | fallow cognitive | lines |
|---|---|---|---|---|
| `assertNoMcpCollisions` (stage.ts) | 9 | 6 | 9 | 23 |
| `walkMcpSources` (collision-slots.ts) | 1 | 2 | 1 | 15 |

`partitionServers` reached 16 under ESLint after the overlay split; the owned-entry loop moved into `ownedServers`, and it now measures fallow 5 / 7.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only (columns unchanged):

- `bridges/mcp/stage.ts:294:48` -> `:334:48` (filter `:294:22` -> `:334:22`)
- `bridges/mcp/stage.ts:341:42` -> `:381:42` (filter `:341:16` -> `:381:16`)
- `bridges/mcp/stage.ts:57:29` -> `:58:29` (filter `:57:3` -> `:58:3`)
- `bridges/mcp/types.ts:94:52` did not move.

## D-02-17 extension

The same-owner filter in `assertNoMcpCollisions` ignores the source a declaration came from, so the plugin's own marked entries never count in any of the nine sources. Tests pin each case named by D-02-12, D-02-13 and D-02-17: the same scope's legacy `mcp.json` (update), the other scope's `mcp-adapter.json` (install), the other scope's legacy `mcp.json` (project install over `<agentDir>/mcp.json`), and an ancestor `.pi/mcp-adapter.json` (project install with `~/work` opted in). The residual hand-copied-marker risk stays T-02-23 (accepted).

## Decisions Made

See `key-decisions`. The bare-`~` reading differs from the plan's behavior row ("two valid roots `~` and `~/work`"): adapter 5.0.0 `config.ts` expands only `~/`, and a bare `~` fails its `isAbsolute` check. Upstream parity decides; the test uses the absolute home path for the shallower root.

## Assumptions and carried notes

- The plan's `rg -n "D-02-"` baseline: this plan added no `D-02-` hit (`git diff | grep '^+.*D-02-'` is empty).
- `orchestrators/plugin/shared.ts` (lines 170, 1204) and a `reinstall-flow.test.ts` comment still say "cross-slot" in general prose. They are outside this plan's files and are left as they are.
- `McpServerPartition.overlays` has no production reader yet; plan 02-03 (D-02-10 absorb) consumes it. The type-member gate passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Permission restore ordering in the EACCES walk case**

- **Found during:** Task 1
- **Issue:** `t.after` hooks run in registration order, so the hermetic cleanup removed the tree before the `chmod` restore ran (ENOENT).
- **Fix:** the case enters the hermetic environment directly and restores permissions before cleanup in one `t.after`.
- **Files modified:** `tests/bridges/mcp/collision-slots.test.ts`

**2. [Rule 1 - Lint] Cognitive complexity and sort-in-expression findings**

- **Found during:** Task 3 (ESLint)
- **Issue:** `partitionServers` scored 16; `roots.sort(...)[0]` tripped `sonarjs/no-misleading-array-reverse` (`toSorted` is not in the ES2022 lib).
- **Fix:** split `ownedServers` out of `partitionServers`; sort in its own statement.
- **Files modified:** `adapter-doc.ts`, `collision-ancestors.ts`

**3. [Test shape] Extra cases for coverage and discrimination**

- Added `AFILE-05: names the highest-precedence declarer when several sources define the name` (stage) so the precedence sort runs with several declarers, a "root equal to cwd" row and a lexical-cwd row (ancestors), and a "keeps an overlay in the key the adapter does not load" row (adapter-doc).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 31562 (chars/4 over `git diff f1ca80d1..6bded229`) against the 127000 estimate (25%). Tasks 3 of 3. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

Plan 02-03 can read `partitionServers(...).overlays` for the D-02-10 absorb and carry-forward. Plan 02-04 can route `hadComments`.

## Self-Check: PASSED

- Created files exist: `extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts`, `tests/bridges/mcp/collision-ancestors.test.ts`.
- Code commit `6bded229` exists on `features/mcp-4` and lists all 18 `files_modified` paths.
