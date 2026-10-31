---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 07
subsystem: notifications
tags: [info, notifications, closed-catalog, soft-dep]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "{requires pi-mcp-adapter} marker name (01-04); two-arm adapter probe, PiInventory and inventory seeds (01-05)"
provides:
  - "Companion, CompanionRequirement and companionRequirements(declaresAgents, declaresMcp, declaresWorkflows, probe) in shared/concerns/soft-dep.ts; the three soft-dep markers derive from the same companion-name constants"
  - "PluginInfoComponentsResolved.requires?: readonly CompanionRequirement[]"
  - "The `    requires: <name>[ (missing)], ...` info line, after the component lines and before `dependencies:`"
  - "One softDepStatus(opts.pi) snapshot per info invocation that builds blocks, stamped on every resolved row"
  - "Catalog states installed-with-missing-companion and installed-with-every-companion; 262 states, 39,968 example bytes"
  - "piWithSubagentsLoaded() in the catalog mock Pi"
affects: [01-08, info, output-catalog, soft-dep-probe]

actuals:
  tokens: 8654
  tasks: 2
  commits: 1
plan_head_before: 8d2dfec61d1224bf4b31a0b6dc9b1db6b1fd3d18
plan_head_after: 2502cbf36dd1a0ce699541fc61f8102cb170c54b

tech-stack:
  added: []
  patterns:
    - "An info-surface fact that depends on the soft-dep probe is stamped on the row by the orchestrator from one snapshot; the renderer formats the stamped entries and takes no probe"
    - "A companion name is declared once in shared/concerns/soft-dep.ts; the marker literal and the requires entry both derive from that constant"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - scripts/check-unused-type-members.contracts.json
    - docs/output-catalog.md
    - docs/workflows-compatibility.md
    - tests/architecture/catalog-uat/fixtures/plugin-info.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/catalog-uat/mock-pi.ts
    - tests/shared/concerns/soft-dep.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/edge/handlers/plugin/info.test.ts

key-decisions:
  - "Info names each companion a resolved row needs on a requires: line, stamped by the orchestrator from one softDepStatus snapshot and only formatted by the renderer"

patterns-established:
  - "withCompanionRequirements(block, probe) in info.ts is the one stamp site; both the single-scope and the two-scope paths run every built block through it before notify"

# ADET-01 is also delivered by plan 01-08 (real-Pi RPC proof), so this plan
# does not mark it complete.
requirements-completed: []

coverage:
  - id: D1
    description: "A resolved info row names every companion its components need, sorted by package name, with (missing) on each companion the probe does not find; built-in MCP alone gives `requires: pi-mcp-adapter (missing)` and the mcp-adapter command gives `requires: pi-mcp-adapter`"
    requirement: ADET-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/info.test.ts#ADET-01 (tmp/p07-t1-verify.log, T1_EXIT=0)"
        status: pass
      - kind: unit
        ref: "node --test tests/shared/concerns/soft-dep.test.ts tests/shared/notification-grammar.test.ts (tmp/p07-t1-verify.log)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The catalog records the line on the eight info states that need a companion and adds two states; every info block is byte-compared"
    requirement: ADET-01
    verification:
      - kind: other
        ref: "node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts (262 states, 39,968 bytes)"
        status: pass
    human_judgment: false

duration: 60min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 07: Info requires line Summary

**`/claude:plugin info` now prints a `requires:` line on each resolved row whose components
need a companion extension, for example `requires: pi-mcp-adapter (missing), pi-subagents`.
The info command takes one `softDepStatus` snapshot and stamps the entries on the row. The
renderer only formats them, after the component lines and before `dependencies:`. The
catalog shows the line on eight existing states and adds two states.**

## Performance

- **Duration:** about 60 min, plus the pre-commit run
- **Started:** 2026-10-02T21:16:55Z
- **Completed:** 2026-10-02
- **Tasks:** 2 (Task 1 is a tracer)
- **Files modified:** 15 (4 production, 1 config, 2 docs, 8 test)
- **Node:** v26.10.0

## Accomplishments

- `shared/concerns/soft-dep.ts` (ADET-01):
  - Exports `Companion` (`"pi-dynamic-workflows" | "pi-mcp-adapter" | "pi-subagents"`) and
    `CompanionRequirement { companion, missing }`.
  - Declares each companion name once as a module constant. The three `SOFT_DEP_MARKER_*`
    values are now `requires ${...}` template literals over those constants and still
    type-check as `Reason`. Their push order in `softDepMarkers` is unchanged.
  - `companionRequirements(declaresAgents, declaresMcp, declaresWorkflows, probe)` returns
    one entry per declared kind in companion-name order, with `missing` equal to the
    negation of the matching probe field.
- `shared/notification-types.ts`: `PluginInfoComponentsResolved` gains
  `readonly requires?: readonly CompanionRequirement[]`. The unresolved arm has no such field.
  The type import of `./concerns/soft-dep.ts` stays on its line, so the line-648 pin holds.
- `shared/notification-grammar.ts`: `appendRequiresLine` pushes
  `    requires: <entries joined by ", ">`, each entry the companion name plus ` (missing)` when
  tagged. `appendResolvedComponentLines` takes `requires` and calls it before
  `appendDependenciesLine`. The renderer imports no probe; its parameter type is the indexed
  `PluginInfoComponentsResolved["requires"]`, so the import block did not move.
- `orchestrators/plugin/info.ts`: after the marketplace-not-added early return,
  `getPluginInfoWithReader` takes `const probe = softDepStatus(opts.pi)`. The new private
  `withCompanionRequirements(built, probe)` stamps `requires` on a resolved row when
  `companionRequirements` returns entries, through a conditional spread. Both the single-scope
  block and every two-scope block go through it before the info/failed split. The
  `GetPluginInfoOptions.pi` doc now says info reads one snapshot and `notify` takes its own.
- Tests:
  - `soft-dep.test.ts`: three `companionRequirements` rows (none declared, MCP declared with
    the adapter absent, all three with mixed probe states) and three agreement rows, one per
    kind, that compare the marker with the requires entry.
  - `notification-grammar.test.ts`: the line's position between components and
    `dependencies:`/`note:`, the `(missing)` format, formatting as stamped against a probe that
    disagrees, and no line for an absent or empty list.
  - `orchestrators/plugin/info.test.ts`: `makeCtx` gains `orchestratorProbes` (default 1) and
    an `inventory` parameter. New ADET-01 cases: built-in MCP seeds give
    `requires: pi-mcp-adapter (missing)`, the `adapterCommand()` seed gives
    `requires: pi-mcp-adapter`, a plugin with no companion kind gets no line, and a
    `components: not resolved` row whose entry declares agents and MCP gets no line.
  - `edge/handlers/plugin/info.test.ts`: the three delegating cases state 2 probes, and the
    header's measured-count note says why.
- Catalog: `installed-with-missing-companion` (agents + MCP, `piWithSubagentsLoaded()`) and
  `installed-with-every-companion` (agents + MCP + workflows, `piWithBothLoaded()`), plus a
  closed-catalog amendment paragraph in the info intro. The eight existing states carry the
  line their fixture's `pi` helper implies.
- `docs/workflows-compatibility.md`: the severity paragraph now says `list` renders the marker
  and `info` names the engine on its `requires:` line, tagged `(missing)` when the engine is
  absent.

## Catalog byte arithmetic

| Step | States | Example bytes | Delta |
| --- | --- | --- | --- |
| Start (after 01-04) | 260 | 39,183 | |
| Task 1: `installed-with-missing-companion` | 261 | 39,413 | +230, the new block's bytes |
| Task 2: eight `requires:` lines + `installed-with-every-companion` | 262 | 39,968 | +555 = 262 (eight lines, each with its newline) + 293 (new block) |

Lines added in Task 2: `requires: pi-subagents` on `installed-single-scope`,
`installed-single-scope-with-dependencies`, `installed-single-scope-with-dependency-constraints`
and the user block of `installed-both-scopes-fan-out`; `requires: pi-dynamic-workflows,
pi-subagents` on `installed-with-workflows`; `requires: pi-dynamic-workflows` on
`installed-with-workflow-preview-note`, `installed-with-workflow-gate-note` and
`state-only-installed-with-workflows`.

## Contract pins

`git diff --numstat 8d2dfec6 -- scripts/check-unused-type-members.contracts.json` reports
`4 4`: only the `id` and `filter` lines of two contracts moved, columns unchanged.

| Contract | Before | After | Delta |
| --- | --- | --- | --- |
| `composeStateOnlyComponents.components` (info.ts) | `1691:49` / `1691:24` | `1693:49` / `1693:24` | +2 (two runtime imports) |
| `isDescriptionBearingRow` (notification-grammar.ts) | `1596:46` / `1596:9` | `1621:46` / `1621:9` | +25 (doc lines, `requires` parameter, `appendRequiresLine`) |

`notification-grammar.ts:842` and `notification-types.ts:648` did not move.
`npm run lint:type-members` exits 0 (4 recorded exceptions).

## Task Commits

1. **Tasks 1 and 2 (one commit, as the plan specifies)** - `2502cbf3`
   (`feat(info): name required companions on the info row`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, state.json).

The code commit SHA was fixed before the pre-commit run, as in earlier plans. The commit object
was built with `git commit-tree` from a temporary index holding HEAD plus the 15 changed files
(tree `6d611f32`), with author and committer dates pinned to `2026-10-02T22:10:00+0000`.
`git commit` then uses the same tree, parent, dates and message.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

- **Task 1 (tracer) verify** (`tmp/p07-t1-verify.log`, `T1_EXIT=0`): `npm run typecheck`,
  `npm run lint:type-members`, then `node --test` over the soft-dep, grammar, info, edge info,
  operations and catalog-contract tests (359 pass, 0 fail). The verify ran after all Task 1
  work, so Task 2 started. `workflow.auto_advance` is false and the verify is automated-only,
  so no checkpoint was needed.
- **Task 2 verify** (`tmp/p07-t2-verify.log`): the catalog contract passed (4 of 4) and
  `npm run test:architecture` reported 459 pass, 1 fail. The failure was
  `catalog-parser.test.ts`, which pins the state count too (see deviation 1). After that fix,
  `node --test tests/architecture/catalog-uat/catalog-parser.test.ts` passes 15 of 15.
- **ESLint** on the 11 changed TypeScript files (`tmp/p07-eslint1.log`): exit 0.
- **Fallow:** `npm run fallow` exits 0 (`tmp/p07-fallow2.log`). `fallow audit --format json
  --quiet --explain --gate-marker agent` gives verdict `warn`, not `fail`
  (`tmp/p07-fallow-audit.json`). The two introduced clone groups are the parallel message
  literals inside `tests/architecture/catalog-uat/fixtures/plugin-info.ts`.
- **Formatting hooks:** `SKIP=trufflehog,npm-check-changed pre-commit run --files <15 code
  paths>` exits 0 (`tmp/p07-precommit-fmt.log`).
- **Pre-commit:** one run covers the code commit and the docs commit, per the operator's
  pay-once rule: `TMPDIR=/var/tmp/mcp4-p07 SKIP=trufflehog pre-commit run --files <15 code
  paths + SUMMARY, STATE.md, ROADMAP.md, state.json>`, log `tmp/p07-precommit.log`. `git
  commit` runs only after that log ends with `PRECOMMIT_EXIT=0`. A failed hook means no commit.

### Acceptance checks

- `rg -n 'requires\?: readonly CompanionRequirement\[\]'` on notification-types.ts: line 885,
  inside `PluginInfoComponentsResolved`.
- `rg -n 'softDepStatus\(opts\.pi\)'` on info.ts: one line (2906).
- `rg -n '^import .*\bsoftDepStatus\b'` on notification-grammar.ts: no output.
- `grep -n 'requires: pi-mcp-adapter (missing), pi-subagents' docs/output-catalog.md`: line
  2676, inside `installed-with-missing-companion`.
- `grep -n 'EXPECTED_STATE_COUNT = 262'` on the catalog contract: line 39.
- Both new `catalog-state` markers are present (lines 2668 and 2683).
- `grep -n '^    requires: ' docs/output-catalog.md`: 10 lines, one in each of the eight
  updated states and the two new ones. The fan-out state has one, not two (deviation 2).
- `rg -n 'requires: .*pi-mcp([^-]|$)' docs/output-catalog.md`: no output.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` - companion names, types and
  `companionRequirements`
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `requires` on the resolved
  arm
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - `appendRequiresLine` and
  the restated line-order docs
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - the snapshot and
  `withCompanionRequirements`
- `scripts/check-unused-type-members.contracts.json` - two pins shifted
- `docs/output-catalog.md` - amendment, two new states, eight updated states
- `docs/workflows-compatibility.md` - the `info` half of the severity paragraph
- `tests/architecture/catalog-uat/{fixtures/plugin-info.ts,mock-pi.ts,catalog-contract.test.ts,catalog-parser.test.ts}`
  - fixtures, `piWithSubagentsLoaded()`, counts
- `tests/shared/concerns/soft-dep.test.ts`, `tests/shared/notification-grammar.test.ts`,
  `tests/orchestrators/plugin/info.test.ts`, `tests/edge/handlers/plugin/info.test.ts` - the
  cases above

## Decisions Made

- The renderer's `appendRequiresLine` takes `PluginInfoComponentsResolved["requires"]` instead
  of importing `CompanionRequirement`, so the grammar module's import block and the line-842
  pin stay put.
- The orchestrator stamps `requires` on the `(failed)` blocks of the two-scope path too, before
  the split. A failed block is unresolved in every arm today, so it gets no line.
- `companionRequirements` pushes in the fixed order workflows, MCP, agents. That order is the
  companion-name order, and each kind maps to its own companion, so no sort is needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The catalog parser test also pins the state count**
- **Found during:** Task 2 (`npm run test:architecture`)
- **Issue:** `tests/architecture/catalog-uat/catalog-parser.test.ts` asserts 260 catalog
  tuples, and the plan's file list did not name it.
- **Fix:** Title and assertion now say 262.
- **Files modified:** `tests/architecture/catalog-uat/catalog-parser.test.ts`
- **Verification:** the parser test passes 15 of 15.
- **Committed in:** `2502cbf3`

### Other adjustments

- **The fan-out state gets one line, not two.** The plan says both blocks of
  `installed-both-scopes-fan-out` get the line, but the project block has only `skills: s1`.
  The plan's own rule is that each fixture carries what `companionRequirements` returns for its
  components, so only the user block (`agents: a1`) carries `requires: pi-subagents`. The
  acceptance check "the fan-out block twice" does not hold for that reason.
- **`tests/orchestrators/plugin/operations.test.ts` is unchanged.** Its info case uses
  `emptyPiInventory()`, a stub with no read count, and the plugin has only commands and hooks,
  so no probe count or expected message moves.
- **Existing info expectations gained the line.** `makeCtx` in `info.test.ts` reports no
  companion loaded, so 15 existing cases whose plugins have agents, MCP servers or workflows now
  expect a `requires: ... (missing)` line. The shared foo row was split into
  `EXPECTED_FOO_COMPONENT_LINES` and `FOO_WORKFLOWS_REQUIRES_LINE` for the cases that add a
  `workflows:` line. The two marketplace-not-added cases state `makeCtx(1, 0)`.
- **Catalog prose wording.** markdownlint MD038 rejects a code span with leading spaces, so the
  amendment writes `requires: <list>` "at 4-space indent" and `(missing)` "after its name".
- **State verbs.** `state.advance-plan`, `state.record-metric`, `state.add-decision`,
  `state.record-session`, then `state.update-progress` and `roadmap.update-plan-progress`
  ran after this SUMMARY existed. They left `last_activity_desc` and the Current Position
  "Last activity" line naming 01-06, and the frontmatter `completed_plans` at 6, so those three
  lines were hand-edited.

None of these change the plan's scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-08 can prove the line on real Pi: built-in MCP only should print
  `requires: pi-mcp-adapter (missing)` for an MCP plugin.
- ADET-01 stays open in REQUIREMENTS.md until plan 01-08 lands.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-01-SC: accepted. This plan installs no package.
- T-01-11: mitigated. `missing` comes from the same `softDepStatus` snapshot type the markers
  use. The info unit cases cover built-in-only MCP (tagged missing), the adapter command (not
  tagged) and a plugin with no companion kind (no line), so an all-clear cannot show for a
  missing adapter.
- T-01-12: accepted. The line prints only the three fixed companion names.

## Self-Check: PASSED

- All 15 modified files exist with the changes above; this SUMMARY exists.
- `2502cbf3` exists as a commit-tree object (`git cat-file -t` reports `commit`). `git commit`
  makes it HEAD~1 of the docs commit only after `tmp/p07-precommit.log` ends with
  `PRECOMMIT_EXIT=0`.
