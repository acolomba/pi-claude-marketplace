---
phase: 06-mcp-servers
plan: 07
subsystem: mcp
tags: [mcp, resolver, pi-mcp-adapter, cucumber, D-CF6-02, FG-28]

requires:
  - phase: 06-mcp-servers
    provides: "06-03's ordered MCP source merge in domain/mcp-resolution.ts (D-CF6-01); 06-01's stub-server writers in features/lib/mcp-server-files.ts"
provides:
  - "D-CF6-02 rule in domain/mcp-resolution.ts: a file-source defect (missing, unreadable, unparseable, non-map file, a path walk I/O error, or one malformed server in a file) contributes no server, silently; an inline defect or an absolute/escaping reference still refuses the plugin with {malformed mcp}"
  - "features/mcp-server/invalid-configs.feature: 8 scenarios (skip, inline control, a 4-row Outline of skipped file defects, entry and outside-reference refusals)"
  - "features/step_definitions/mcp-server/invalid-configs.steps.ts: the mcp file state Given (missing / not valid JSON / readable by nobody)"
affects: [06-08 docs/mcp-compatibility.md, 06-09 phase gate, AMIG-01 migration]

actuals:
  tokens: 15255
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A per-source malformed-server handler: inline maps add a fatal note, files log to the env-gated `mcp` debug channel"

key-files:
  created:
    - features/mcp-server/invalid-configs.feature
    - features/step_definitions/mcp-server/invalid-configs.steps.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - test/domain/mcp-resolution.test.ts
    - test/domain/plugin-resolver.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/integration/mcp-migration.test.ts

key-decisions:
  - "D-CF6-02: every file source skips silently on any locate, stat, read, or parse failure, on a non-map document, and per malformed server; only inline defects and containment refusals stay fatal"
  - "A containment walk I/O error (ENOTDIR and the like) counts as an unreadable file and skips; only a PathContainmentError refusal stays fatal"
  - "Each skip is logged with hookDebugLog(..., \"mcp\"), env-gated, never a notification, as Claude Code logs it at debug level"

patterns-established:
  - "A scenario outline over broken MCP file states uses one state Given whose quoted value names the state"

requirements-completed: [MCP-04]

coverage:
  - id: D1
    description: "A malformed server in .mcp.json is dropped silently and the plugin's other server answers a scripted call"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/invalid-configs.feature#A malformed server in .mcp.json is skipped and the plugin's other server answers"
        status: pass
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts#D-CF6-02: drops a malformed server in .mcp.json and keeps its other server, with no note"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unparseable .mcp.json, a missing reference, an unparseable reference, and an unreadable reference each contribute no server, silently"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/invalid-configs.feature#A broken MCP config file contributes no server and the plugin's other sources still load"
        status: pass
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts (D-CF6-02 skip cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An inline malformed server (plugin.json or the marketplace entry) and a reference outside the plugin root keep the plugin (unavailable) {malformed mcp}"
    requirement: MCP-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/invalid-configs.feature (three refusal scenarios)"
        status: pass
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts#D-CF6-02: refuses a malformed server in a map that an array holds inline"
        status: pass
    human_judgment: false
  - id: D4
    description: "AMIG-01 inherits the rule: a skipped file-source server is removed by the move, and the migration's malformed arm stays covered through an inline server"
    requirement: MCP-04
    verification:
      - kind: integration
        ref: "test/integration/mcp-migration.test.ts#AMIG-01: /reload skips a malformed server in .mcp.json, moves its valid sibling, and removes the skipped one's old entry (D-CF6-02)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- orchestrators/reconcile/mcp-migration.ts"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-11-01
status: complete
plan_head_before: 20c882a4be1d384d7a7f05aee324c2b0886a65d2
plan_head_after: 7b1a7dd60ba909e6c407ce1eec4273829b4ba61b
---

# Phase 6 Plan 07: MCP server invalid configs Summary

**A malformed MCP server or file in `.mcp.json` or a referenced file is now dropped silently and the rest of the plugin installs, as Claude Code 2.1.316's loader does; an inline malformed server or an out-of-root reference still refuses the plugin with `{malformed mcp}` (D-CF6-02, FG-28).**

## Performance

- **Duration:** 36 min
- **Started:** 2026-11-01T16:35:27Z
- **Completed:** 2026-11-01T17:11:05Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `domain/mcp-resolution.ts`: `mergeServerFile` reads `.mcp.json` and every referenced file the same way. A missing file, a stat/read/parse failure (EACCES and non-Error rejections included), a document with no server map, and each malformed server inside the file contribute nothing, with no note and no dirty flag. `locateReference` keeps the absolute and escaping refusals fatal and turns a containment walk I/O error (such as ENOTDIR) into a skip. Inline maps keep the fatal `malformed mcp server "<name>": ...` note. Each skip goes to `hookDebugLog(..., "mcp")`.
- `features/mcp-server/invalid-configs.feature` (8 scenarios): the skip scenario with the whole model calls, the inline `plugin.json` negative control, a 4-row Outline of skipped file states, and the entry and `../outside.json` refusals.
- The pins of the old rule now pin the rule that remains: seven `plugin-resolver.test.ts` cases expect an installable plugin, and four downstream tests move their malformed server inline in `plugin.json`, keeping titles and expected outputs.
- A new AMIG-01 integration case shows the move skips a `.mcp.json` malformed server, writes its valid sibling with the bytes a fresh install writes, and removes the skipped one's old entry (`hello no longer declares it.`, severity `info`, measured).

## Task Commits

1. **Task 1 (tracer): skip a malformed server in .mcp.json** - RED `634908d` (test), GREEN `954c73c` (fix)
2. **Task 2: downstream pins and skipped file defects** - `f2ae3ef` (test)
3. **Task 3: entry and outside-reference refusals** - `7b1a7dd` (test)

The planned intermediate red (P6-DC-08 item 5) is the single commit `954c73c`: at that commit, `install-flow-ledger.test.ts` (ANAME-07, WLIF-01), `test/orchestrators/reconcile/mcp-migration.test.ts` (AMIG-01 malformed) and `test/integration/mcp-migration.test.ts` (AMIG-01 malformed) fail; `f2ae3ef` turns them green.

## Red proof

- **Skip scenario, before the fix** (`npx cucumber-js features/mcp-server/invalid-configs.feature`, seed 151971, on `634908d`): "A malformed server in .mcp.json is skipped and the plugin's other server answers" failed at `Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned`: the install returned one error payload, `demo@fixtures` `unavailable` with reasons `["malformed mcp"]`. The inline control "A malformed server written in plugin.json makes the plugin unavailable" passed (2 scenarios: 1 passed, 1 failed).
- **Outline rows, against the pre-fix resolver** (the old `mcp-resolution.ts` copied in temporarily, seed 995879): all four Outline rows and the skip scenario failed in the `which warned` setup. Unparseable `.mcp.json` gave `unavailable {unsupported source}` (the inline-style `malformed mcpServers (.mcp.json)` note falls to the classifier's `unsupported source` bucket); missing and unparseable references gave `unavailable {malformed mcp}`; the unreadable reference gave an error with no reason (the EACCES propagated). 6 scenarios: 1 passed, 5 failed. The resolver was restored before any commit.
- **After the fix:** `features/mcp-server/invalid-configs.feature` passed three runs in a row after each task: Task 1 (seeds 129669, 240952, 91688; 2 scenarios), Task 2 (646389, 397166, 586902; 6 scenarios), Task 3 (440263, 666859, 247903; 8 scenarios).
- **TDD gate:** RED `634908d` precedes GREEN `954c73c`. The RED target failed on the planned assertion (the install result), not on setup or a missing step; the titles carry no plan ID by the session rules, so the gate's commit grep finds neither.

## Handed-over fix

No handed-over fix. The wave-2 SUMMARYs (06-02, 06-04, 06-05, 06-06) record none.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` - the D-CF6-02 skip and inline-fatal rule
- `test/domain/mcp-resolution.test.ts` - rewritten file-defect cases plus one case per behavior row, debug-channel case; 100% direct coverage
- `features/mcp-server/invalid-configs.feature` - `Feature: MCP server invalid configs`
- `features/step_definitions/mcp-server/invalid-configs.steps.ts` - the mcp file state Given
- `test/integration/mcp-migration.test.ts` (owned) - the malformed case moved inline; the new AMIG-01 skip case

### Non-owned test edits (limited to the named tests)

- `test/domain/plugin-resolver.test.ts`: only the seven named tests ("MCPR-03 missing reference file", "MCPR-03 malformed-JSON reference file", "WR-03: unreadable reference file (EACCES)", "MCPR-04 reference path traversing a non-directory (ENOTDIR)", "MCPR malformed standalone .mcp.json", "MCPR-03 wrapped reference with malformed INNER map", "resolveStrict ... non-Error standalone mcp read rejection"): new titles citing D-CF6-02, whole installable result asserted, arrange unchanged except comments that described the old rule. The fatal-case tests (MCPR-04 escape, symlink, absolute, PR-2(6), ANAME-07 inline) are unchanged.
- `test/orchestrators/plugin/install-flow-ledger.test.ts`: the arrange steps of "ANAME-07: a server Claude Code's schema rejects makes the plugin unavailable with {malformed mcp}" and "WLIF-01: an undo before the workflows phase ran removes nothing and does not throw" now overwrite `plugin.json` with an inline malformed server.
- `test/orchestrators/reconcile/mcp-migration.test.ts`: the arrange step of "AMIG-01: a plugin whose MCP config is malformed has every legacy entry removed, none written, and its inventory emptied" does the same.
- `git diff --stat 20c882a..HEAD -- domain/plugin-resolver.ts orchestrators/ shared/` prints nothing.

## Decisions Made

- File-source defects skip silently, including EACCES (research Open Questions 1-2, D-CF6-02 amended); inline defects and containment refusals stay fatal.
- A containment walk I/O error skips (plan's flagged assumption), so "MCPR-04 ... ENOTDIR" now resolves installable.
- The optional debug line is used: `[mcp] <file> of <pluginRoot>: skipped the file: <reason>` or `skipped the server "<name>": <detail>`, pinned whole by one unit case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Outline uses one state Given instead of three separate Givens**
- **Found during:** Task 2
- **Issue:** A Scenario Outline runs the same steps for every row, so it cannot use the frozen text Given for two rows, skip it for the missing row, and add a chmod Given only for the unreadable row, as the plan's action described.
- **Fix:** One new Given, `the mcp file {string} of the published plugin {string} of the marketplace {string} is {string}`, with the states `missing`, `not valid JSON`, and `readable by nobody`. It writes through the frozen `writePublishedPluginFiles` and the owned `publishStubServersFile`, asserts each state (ENOENT, the exact text, EACCES), and restores `0o644` in a release. The unreadable file holds a stub server `hidden`, so a resolver that read it would list `mcp__plugin_demo_hidden__echo`. The plan's step text `the published file ... cannot be read by anyone` is not registered (an unused step fails `check:features`).
- **Files modified:** features/step_definitions/mcp-server/invalid-configs.steps.ts, features/mcp-server/invalid-configs.feature
- **Verification:** Outline rows red against the old resolver, green three runs in a row; `check:features` passes.
- **Committed in:** f2ae3ef

**2. [Rule 3 - Blocking] The Outline's surviving source is an inline manifest server in every row**
- **Found during:** Task 2
- **Issue:** The plan's rows put the surviving server in `.mcp.json` for the three reference rows and in the manifest for the `.mcp.json` row. With uniform Outline steps, `.mcp.json` cannot be the broken file in one row and the good file in the others.
- **Fix:** Every row declares `good` inline in `plugin.json` (the reference rows as `["./servers.json", {"good": ...}]`), and the broken file is `.mcp.json` or `servers.json`. The `.mcp.json`-as-survivor case is pinned by the unit cases "D-CF6-02: skips ... and keeps the .mcp.json servers".
- **Committed in:** f2ae3ef

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact:** the Outline proves the same four defects; only the step shape differs from the plan text.

## Issues Encountered

- The worktree bash guard refused commands that name `.git/worktrees/...`, so the plan ledger base was kept in the scratchpad (`20c882a`), not in the git dir.
- The pre-fix unparseable `.mcp.json` row showed `{unsupported source}`, not `{malformed mcp}`: `shared/probe-classifiers.ts` sends an inline-style `malformed mcpServers` note to `unsupported source` by design. After the fix only an inline non-map value produces that note; unchanged and out of scope.

## Verification

- `node --test test/domain/mcp-resolution.test.ts test/domain/plugin-resolver.test.ts`: 249 pass.
- `npm run test:coverage:direct --` `domain/mcp-resolution.ts` `domain/plugin-resolver.ts`, and `orchestrators/reconcile/mcp-migration.ts` `orchestrators/plugin/install-flow-ledger.ts`: exit 0 (100%).
- `node --test` install-flow-ledger + reconcile/mcp-migration: 371 pass.
- `npm run test:integration`: exit 0 (after Task 2).
- `npx cucumber-js features/mcp-server`: 52 scenarios, 663 steps passed (seed 346769).
- `npm run check:static` passed after Tasks 1 and 2 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features); `check:features` and `test:unpaired` passed after Task 3.
- `npm run test:modules`: exit 0 (after Task 3).
- Acceptance: `grep -c D-CF6-02 mcp-resolution.ts` = 6; `^Feature: MCP server invalid configs$` = 1; `Scenario Outline: A broken MCP config file` = 1 with 4 rows; `malformed mcp` in the feature = 3; `D-CF6-02` in `test/integration/mcp-migration.test.ts` >= 1.

## Parent lines

- `docs/output-catalog.md` line ~148 (`(unavailable)` row): replace "a broken `mcpServers` string reference -- missing file / malformed JSON / wrapper-less / out-of-root -> `{malformed mcp}`, or a server config that Claude Code's schema rejects -> `{malformed mcp}`" with "an `mcpServers` reference that is absolute or leaves the plugin root, or a server config written inline in `plugin.json` or the marketplace entry that Claude Code's schema rejects -> `{malformed mcp}`; a missing, unreadable, or unparseable MCP file, and a rejected server inside a file, are skipped silently (D-CF6-02)".
- `docs/output-catalog.md` line ~736, last sentence: "A server config that Claude Code's own schema rejects is a different case: when it is written inline in `plugin.json` or the marketplace entry it is a structural defect, and the plugin is `(unavailable) {malformed mcp}`; inside `.mcp.json` or a referenced file it is dropped silently and the other servers install (D-CF6-02)."
- `docs/output-catalog.md` line ~3395: "Structural errors include ... an `mcpServers` reference that is absolute or leaves the plugin root, and a server config written inline that Claude Code's schema rejects. ... (MCPR-04 / D-CF6-02 / ANAME-07). A rejected inline server config makes the whole plugin unavailable ...; a missing, unreadable, or unparseable MCP file and a rejected server inside a file contribute no server, with no message."
- `docs/output-catalog.md` line ~5357 (migration notice example): still right for an inline-invalid config; no change needed.
- PRD `docs/prd/pi-claude-marketplace-prd.md` MC-3 (line ~479): "A plugin whose inline `mcpServers` declaration (manifest or marketplace entry) holds a value or server that Claude Code's schema rejects, or whose reference is absolute or leaves the plugin root, MUST surface as **unavailable** with `{malformed mcp}`. A missing, unreadable, or unparseable MCP file, and a rejected server inside a file, contribute no server, silently, as Claude Code's loader does (D-CF6-02)." MC-1's "malformed at the matched source MUST throw" is already superseded by D-CF6-01's merge; reword with MC-3.
- `CHANGELOG.md`: "A plugin whose `.mcp.json` or referenced MCP file holds a server Claude Code rejects, or that cannot be read or parsed, now installs with its other servers, as Claude Code does; a bad server written inline still refuses the plugin."

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-16 holds: containment runs before any read and a refusal stays fatal (unit "D-CF6-02: rejects an absolute/traversing string reference without reading it", the symlink case, and the `../outside.json` scenario). The new debug line is env-gated (`PI_CLAUDE_MARKETPLACE_DEBUG=1`) and holds the plugin root and the file name, as other debug lines do.

## Known Stubs

None.

## Next Phase Readiness

- 06-08 can document the rule as implemented: silent skip for file sources, `{malformed mcp}` for inline defects and bad reference paths.
- 06-09's gate should run `npm run check` on the merged tree; the integration and module suites passed here.

## Self-Check: PASSED

- Files exist: invalid-configs.feature, invalid-configs.steps.ts, mcp-resolution.ts.
- Commits on this branch: 634908d, 954c73c, f2ae3ef, 7b1a7dd.

## Dubious Choices

1. **Silent skip with a debug line, no warning.** Alternatives: the discovery-warning diagnostic (needs four unowned edits) or no debug line. Dubious because a user loses a bad server with no message, exactly as in Claude Code; the debug line exists only with `PI_CLAUDE_MARKETPLACE_DEBUG=1`.
2. **An unreadable file (EACCES) and a containment walk I/O error (ENOTDIR) skip instead of failing with `{permission denied}`.** Alternative: keep propagating I/O errors. Dubious because a real permission problem on the user's disk now goes unreported; upstream's loader skips it too.
3. **One Outline state Given (`... is "readable by nobody"` etc.) in place of the plan's `cannot be read by anyone` Given plus frozen text Givens.** Alternative: four separate scenarios, which the acceptance's Outline criterion rules out. Dubious because the state words live in a step's switch, though each value reads plainly in the feature.
4. **The Outline's surviving server is inline in every row**, not `.mcp.json` for the reference rows as the plan listed. Alternative: a fifth Given writing an unused file in row 1. Dubious because the `.mcp.json`-survives-a-bad-reference path is pinned only by unit cases, not by a scenario.
5. **The seven plugin-resolver tests keep their arrange and assert installable with no servers**, rather than adding another source to show it survives. Alternative: add a `.mcp.json` to each. Chosen to keep the out-of-ownership diff to outcomes and titles, as the plan says; the "other sources still load" claim is pinned in `mcp-resolution.test.ts` and the scenarios.
