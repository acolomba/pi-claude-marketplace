---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 05
subsystem: notifications
tags: [soft-dep-probe, detection, pi-api]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "Pi 1.0 floor and toolInfo seed (01-01), expectSoftDepProbes (01-02), {requires pi-mcp-adapter} marker (01-04)"
provides:
  - "PiInventory (renamed from the tool-only port) with getCommands(), and CommandInventoryItem, in platform/pi-api.ts"
  - "hasLoadedPiMcpAdapter: two independently guarded arms, the mcp-adapter command (with Pi's :<digits> suffix) or a pi-mcp-adapter source"
  - "tests/platform/pi-inventory-seed.ts: emptyPiInventory, adapterCommand, adapterProxyTool, forkAdapterCommand, builtinMcpTool, builtinMcpCommand, foreignMcpTool"
  - "expectSoftDepProbes(pi, probes, tools?, commands?) states getAllTools x3 and getCommands x1 per probe"
  - "makeMockPi(tools, slashCommands?) and installTargetWithMockPi(env, plugin, tools, slashCommands?) in tests/e2e/_helpers.ts"
  - "Unit detection matrix for every D-01-06 state and boundary row, with strict read-shape cases"
affects: [01-06, 01-07, 01-08, notify, soft-dep-probe]

actuals:
  tokens: 30658
  tasks: 2
  commits: 2
plan_head_before: acde7128d70eaa5e8ffdeb447315e7c4d5dbbc91
plan_head_after: 9117860f60fe3c62e2c86416fa82b195a69888b2

tech-stack:
  added: []
  patterns:
    - "A soft-dependency probe arm runs through probeArm(): a throw reads as not loaded and never sinks a sibling arm"
    - "Both MCP arms always run, so a snapshot's read shape is fixed: getAllTools() x3, getCommands() x1"
    - "Pi inventory doubles come from tests/platform/pi-inventory-seed.ts and are typed with Pi's own ToolInfo / SlashCommandInfo"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - tests/platform/pi-inventory-seed.ts
    - tests/platform/pi-api.test.ts
    - tests/edge/notification-boundary.ts
    - tests/architecture/catalog-uat/mock-pi.ts
    - tests/e2e/_helpers.ts
    - tests/e2e/install-soft-deps.test.ts

key-decisions:
  - "pi-mcp-adapter counts as loaded by an extension command named mcp-adapter (optional :<digits> suffix, exact case) or by a command or tool sourceInfo.source containing pi-mcp-adapter; a bare mcp tool and Pi's built-in MCP do not count"
  - "Only the command-name match requires source === \"extension\"; a pi-mcp-adapter source counts whatever the command kind"

patterns-established:
  - "A double that means \"adapter loaded\" plants adapterCommand(), never a bare mcp tool"

# ADET-01 and ADET-02 are also delivered by plans 01-06 (e2e matrix, PRD rules),
# 01-07 (info line) and 01-08 (real-Pi RPC proof), so this plan marks neither.
requirements-completed: []

coverage:
  - id: D1
    description: "The two-arm probe counts the adapter by command or source; a foreign mcp tool and the built-in MCP alone read as not loaded; every strict double and the e2e mock Pi answer getCommands"
    requirement: ADET-02
    verification:
      - kind: unit
        ref: "npm run typecheck && npm run lint:type-members && contracts diff && npm run test:modules && npm run test:architecture (tmp/p05-t1-verify.log: 7788 + 460 pass, 0 fail, T1_EXIT=0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An install through the real extension on the e2e mock Pi keeps {requires pi-mcp-adapter} with only the built-in MCP and clears it with a command-only adapter"
    requirement: ADET-01
    verification:
      - kind: e2e
        ref: "PI_CM_E2E_REF=pinned node --test tests/e2e/install-soft-deps.test.ts (tmp/p05-t1-verify.log, 6 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The unit matrix proves every D-01-06 state, each boundary row and the throwing arms, and two strict mocks pin three getAllTools() reads and one getCommands() read per snapshot"
    requirement: ADET-02
    verification:
      - kind: unit
        ref: "node --test tests/platform/pi-api.test.ts and npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts (tmp/p05-t2-green.log: 51 pass; branches 24/24, functions 13/13, lines 248/248)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 05: Adapter-only MCP detection Summary

**The MCP soft-dependency probe now counts pi-mcp-adapter by its own `mcp-adapter` command or
by a `pi-mcp-adapter` source. A foreign `mcp` tool and Pi's built-in MCP no longer hide
`{requires pi-mcp-adapter}`. The port that the probes read is renamed `PiInventory` and gains
`getCommands()`. No production file changed its line count except `platform/pi-api.ts`, and
its contract pins did not move.**

## Performance

- **Duration:** about 70 min, plus the pre-commit run
- **Started:** 2026-10-02T19:45:23Z
- **Completed:** 2026-10-02
- **Tasks:** 2 (Task 1 is a tracer)
- **Files modified:** 42 (22 production, 20 test)
- **Node:** v26.10.0

## Accomplishments

- `platform/pi-api.ts` (ADET-02):
  - Adds `CommandInventoryItem`. Its `name`, `source` and `sourceInfo.source` are all
    `unknown`, and the probe narrows each one with `typeof` (T-01-10).
  - `PiInventory` declares `getAllTools()` and `getCommands()`.
  - `ADAPTER_COMMAND_NAME = /^mcp-adapter(?::\d+)?$/` matches the name exactly. It accepts
    Pi's collision suffix as a run of digits and never parses it as a number.
  - `isAdapterSource` is a plain substring test for `pi-mcp-adapter`.
  - `probeArm` turns a throwing arm into "not loaded".
  - `hasLoadedPiMcpAdapter` runs the command arm and then the tool-source arm, and combines
    them with `||` only after both have run. No tool-name check remains.
  - The header keeps its 8 comment lines. Every other edit sits below line 125, so the pins
    on lines 100, 106, 107, 108 and 124 hold.
- The rename touched 21 production importers with one word-bounded replacement. Prettier
  changed nothing, and every importer shows equal added and deleted counts (see the evidence
  below). `ToolInventoryItem` is unchanged.
- `tests/platform/pi-inventory-seed.ts` adds seven seeds next to `toolInfo`, typed with Pi's
  own `ToolInfo` / `SlashCommandInfo`. `builtinMcpTool()` and `builtinMcpCommand()` carry the
  2026-10-02 sandboxed Pi 1.0.0 RPC capture, and a comment cites that run.
- `expectSoftDepProbes` states `getCommands()` `.times(probes)` next to
  `getAllTools()` `.times(probes * 3)`. Its JSDoc says one snapshot makes three tool reads and
  one command read.
- The catalog double's `piWith*Loaded` helpers and every test double that meant "adapter
  loaded" now plant `adapterCommand()`. The inline empty doubles use `emptyPiInventory()`, 32
  of them in `prune.test.ts`.
- `makeMockPi` always defines `getCommands`. Two new e2e cases install context7: a
  command-only adapter shows no `{requires pi-mcp-adapter}`, and the built-in seeds keep it.
- Task 2 replaces the MCP rows of the `softDepStatus` block with 24 data rows, three
  throwing-arm cases and two strict-mock read-shape cases. Each row's expected
  `SoftDepStatus` is an independent literal.

## Task Commits

1. **Task 1 (tracer): adapter detected by its command or source** - `9d1c8a36`
   (`fix(notify): detect pi-mcp-adapter by its command or source`)
2. **Task 2: the detection matrix in the unit layer** - `9117860f`
   (`test: cover the pi-mcp-adapter detection matrix`)

**Plan metadata:** the docs commit that follows them (SUMMARY, STATE, ROADMAP, state.json).

Both code commit SHAs were fixed before the pre-commit run, as in earlier plans. Each commit
object was built with `git commit-tree` from a temporary index, with pinned author and
committer dates (`2026-10-02T20:40:00+0000` and `2026-10-02T20:41:00+0000`). `git commit`
then uses the same dates, trees and messages. Commit 1's tree holds the Task 1 version of
`tests/platform/pi-api.test.ts` (blob `00570e53`). Commit 2 adds the matrix.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

- **Task 1 verify** (`tmp/p05-t1-verify.log`, `T1_EXIT=0`): `npm run typecheck`,
  `npm run lint:type-members`, `git diff --exit-code acde7128 --
  scripts/check-unused-type-members.contracts.json` (`CONTRACTS_UNCHANGED`),
  `npm run test:modules` (7788 pass, 0 fail, 0 skipped), `npm run test:architecture` (460
  pass, 0 fail), and `PI_CM_E2E_REF=pinned node --test tests/e2e/install-soft-deps.test.ts`
  (6 pass: the four matrix rows and the two new ADET cases).
- **Tracer gate:** this verify ran after all Task 1 work and passed end to end, so Task 2
  started. `workflow.auto_advance` is false and the verify is automated-only, so no checkpoint
  was needed.
- **Task 1 direct coverage** (`tmp/p05-t1-coverage.log`, `COV_EXIT=0`): branches 23/23,
  functions 13/13, lines 248/248 on the Task 1 test version.
- **Task 2 RED** (`tmp/p05-t2-red.log`, `RED_EXIT=1`): the final `pi-api.test.ts` was run
  against the base probe (`acde7128`'s `pi-api.ts`, restored afterwards; `cmp` confirmed it).
  The result was 51 tests, 39 pass, 12 fail. The failures are the command-only, fork,
  `mcp-adapter:1/2`, `mcp-adapter:2`, `mcp-adapter:10`, built-in-plus-adapter, foreign `mcp`
  tool, command-source and throwing-`getAllTools()` rows, both strict read-shape cases, and
  the composed all-loaded row.
- **Task 2 GREEN** (`tmp/p05-t2-green.log`, `GREEN_EXIT=0`): 51 pass, 0 fail. Direct coverage
  of `platform/pi-api.ts`: branches 24/24, functions 13/13, lines 248/248.
- **Fallow audit** (`fallow audit --format json --quiet --explain --gate-marker agent`,
  `tmp/p05-fallow-audit.json`): verdict `pass`.
- **Pre-commit:** one run covers both code commits and the docs commit, per the operator's
  pay-once rule: `TMPDIR=/var/tmp/mcp4-p05 SKIP=trufflehog pre-commit run --files <42 code
  paths + tracking files>`, log `tmp/p05-precommit.log`. The plan's per-task logs
  `tmp/p05a-precommit.log` and `tmp/p05b-precommit.log` are this one log. `git commit` makes
  the two code commits only if that log ends with `PRECOMMIT_EXIT=0`. A failed hook means no
  commit.

### Production line counts (`git diff --numstat acde7128 9d1c8a36 -- extensions`)

| File | Added | Deleted |
| --- | --- | --- |
| `orchestrators/marketplace/add.ts` | 2 | 2 |
| `orchestrators/marketplace/autoupdate.ts` | 2 | 2 |
| `orchestrators/marketplace/remove.ts` | 2 | 2 |
| `orchestrators/marketplace/shared.ts` | 2 | 2 |
| `orchestrators/marketplace/update.ts` | 4 | 4 |
| `orchestrators/plugin/enable-disable.ts` | 6 | 6 |
| `orchestrators/plugin/info.ts` | 2 | 2 |
| `orchestrators/plugin/install-flow.ts` | 7 | 7 |
| `orchestrators/plugin/prune.ts` | 2 | 2 |
| `orchestrators/plugin/reinstall-flow.ts` | 3 | 3 |
| `orchestrators/plugin/reinstall.messaging.ts` | 2 | 2 |
| `orchestrators/plugin/shared.ts` | 3 | 3 |
| `orchestrators/plugin/uninstall.ts` | 5 | 5 |
| `orchestrators/plugin/update-cascade.ts` | 2 | 2 |
| `orchestrators/plugin/update-flow.ts` | 5 | 5 |
| `orchestrators/plugin/update-preflight.ts` | 2 | 2 |
| `orchestrators/plugin/update-swap.ts` | 2 | 2 |
| `orchestrators/reconcile/pending.ts` | 2 | 2 |
| `orchestrators/reconcile/types.ts` | 2 | 2 |
| `platform/pi-api.ts` | 64 | 23 |
| `shared/notification-dispatch.ts` | 6 | 6 |
| `shared/notify-context.ts` | 5 | 5 |

### Acceptance checks

- `rg -n '\bToolInventory\b' extensions tests --glob '!tests/live-uat/**'`: no output.
  `rg -n 'interface PiInventory' .../platform/pi-api.ts`: one line (160).
- `rg -n 'name === "mcp"' .../platform/pi-api.ts`: no output.
- `rg -n '\{ name: "mcp" \}' tests --glob '!tests/live-uat/**'`: no output. No double plants
  a bare `mcp` tool any more; the foreign case uses `foreignMcpTool()`.
- `rg -n 'builtin:mcp' tests/platform/pi-inventory-seed.ts`: lines 81 and 90, the two
  built-in seeds.
- `rg -n 'ADET-02' tests/platform/pi-api.test.ts` lists disableProxyTool, fork,
  `mcp-adapter:2`, `mcp-adapter:10`, the foreign `mcp` tool, throwing `getCommands()`,
  throwing `getAllTools()` and both arms throwing. `rg -n 'ADET-01'` lists built-in only,
  neither, and built-in plus adapter. `rg -n 'verify\('` prints the strict read-shape case.
- `SoftDepStatus` keeps exactly its three fields. No built-in MCP probe and no second MCP
  token exist (D-01-03).

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/pi-api.ts` - `CommandInventoryItem`,
  `PiInventory`, the two-arm `hasLoadedPiMcpAdapter`, header restated in 8 lines
- 21 production importers - `ToolInventory` renamed to `PiInventory`, one line for one line
- `tests/platform/pi-inventory-seed.ts` - seven new seeds
- `tests/platform/pi-api.test.ts` - the detection matrix and read-shape cases
- `tests/edge/notification-boundary.ts` - `expectSoftDepProbes` states `getCommands()`
- `tests/architecture/catalog-uat/mock-pi.ts` - `makePi(tools, commands)`; loaded helpers
  plant `adapterCommand()`
- `tests/e2e/_helpers.ts`, `tests/e2e/install-soft-deps.test.ts` - `getCommands` on the mock
  Pi; two ADET e2e cases
- 14 further test files - doubles gain `getCommands`, "adapter loaded" doubles plant
  `adapterCommand()`, empty doubles use `emptyPiInventory()`

## Decisions Made

- Only the name match is limited to `source === "extension"`. A command whose
  `sourceInfo.source` names `pi-mcp-adapter` counts whatever its kind. That keeps a prompt or
  skill named `mcp-adapter` from counting and still follows D-01-05's source rule.
- The matrix's name-boundary rows plant their commands with source `cli` (what a
  `--extension` fixture reports), so they test the name rule alone and not the source rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's test version keeps direct coverage at 100%**
- **Found during:** Task 1
- **Issue:** With the plan's minimal Task 1 edits, `platform/pi-api.ts` direct coverage was
  98.39% lines and 90.91% branches. The adapter seed's source matches before the name check,
  so no Task 1 row reached the name path, and the D-08-05 direct-coverage gate failed
  (`COV_EXIT=1`).
- **Fix:** Task 1's version of `pi-api.test.ts` also has the row "ADET-02 recognizes a fork's
  mcp-adapter command". Task 2 replaces it with the full matrix.
- **Files modified:** `tests/platform/pi-api.test.ts`
- **Commit:** `9d1c8a36`

**2. [Rule 1 - Bug] More "adapter loaded" doubles than the planned site list**
- **Found during:** Task 1
- **Issue:** `install-flow.test.ts` has 8 cases with `toolNames: ["mcp", "subagent"]`,
  `reinstall-flow.test.ts` has 18 (the plan named 2), and `enable-disable.test.ts:3486` has
  one. Each meant "adapter loaded" and would have flipped silently.
- **Fix:** each one now plants `adapterCommand()` through a `commands` option on the suite's
  `makeCtx` / `makePi`.
- **Files modified:** the three suites
- **Commit:** `9d1c8a36`

**3. [Rule 1 - Bug] e2e helper parameter shadowed the command map**
- **Found during:** Task 1
- **Issue:** a `commands` parameter on `makeMockPi` collides with its local `commands` map
  (lint: unsafe call).
- **Fix:** the parameter is named `slashCommands` in `makeMockPi` and
  `installTargetWithMockPi`.
- **Commit:** `9d1c8a36`

### Other adjustments

- `builtinMcpTool()` sets `namespace: { name: "mcp__stub" }`. Pi 1.0's `ToolNamespace` is an
  object, and the capture lists only its name. `description` and `parameters` are
  placeholders that `ToolInfo` requires, and a comment says so.
- The seed comment refers to "the real-Pi RPC test for ADET-01" rather than a path, because
  `tests/e2e/adapter-detection-rpc.test.ts` does not exist until plan 01-08. That plan edits
  the seed file and can name the path.
- The PI-12 line in `install-flow.test.ts`'s header now says "no `mcp-adapter` command".
- Per the operator's pay-once rule, one pre-commit run covers both code commits and the docs
  commit, instead of one run per commit.

## Issues Encountered

Several test files build Pi doubles with a cast (`as ExtensionAPI`, `as never`) and define only
`getAllTools`. Examples are `tests/architecture/config-state-consistency.test.ts`, several
`tests/integration/*` suites, and `tests/orchestrators/plugin/shared.test.ts`. They all mean
"nothing loaded". Without `getCommands`, the command arm throws and reads as not loaded, which
gives the same answer, so they still pass. They are outside this plan's file list and were
left unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-06 can run all six D-01-06 states through `installTargetWithMockPi(env, plugin,
  tools, slashCommands)` with the seeds.
- Plan 01-08's RPC test re-captures the built-in inventory and checks it against
  `builtinMcpTool()` / `builtinMcpCommand()`.
- ADET-01 and ADET-02 stay open in REQUIREMENTS.md until plans 01-06 to 01-08 land.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-01-SC: accepted. This plan installs no package.
- T-01-07: mitigated. The foreign `mcp` tool row reads as not loaded.
- T-01-09: mitigated. The throwing-arm rows show that each arm decides alone.
- T-01-10: mitigated. Every inventory field is `unknown` and narrowed with `typeof`. The
  non-string name and source rows read as not loaded.

## Self-Check: PASSED

- The seven seeds exist in `tests/platform/pi-inventory-seed.ts`. `PiInventory` and
  `CommandInventoryItem` exist in `platform/pi-api.ts`.
- `9d1c8a36` and `9117860f` exist as commit-tree objects
  (`git cat-file -t` reports `commit`). `git commit` makes them HEAD~2 and HEAD~1 of the docs
  commit only after `tmp/p05-precommit.log` ends with `PRECOMMIT_EXIT=0`.
- `scripts/check-unused-type-members.contracts.json` is byte-unchanged since `acde7128`.
