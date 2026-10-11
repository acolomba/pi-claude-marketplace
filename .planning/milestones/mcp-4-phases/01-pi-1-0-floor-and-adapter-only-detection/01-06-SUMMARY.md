---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 06
subsystem: testing
tags: [e2e, detection, soft-dep-matrix, prd]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "two-arm pi-mcp-adapter probe, inventory seeds, and makeMockPi(tools, slashCommands) (01-05)"
provides:
  - "tests/e2e/install-soft-deps.test.ts: six pi-mcp-adapter detection states and two pi-subagents states, each one install-and-list case through the real extension"
  - "PRD soft-dependency definition, RH-4 row and section 9.3 probe diagram state the ADET-02 rule"
affects: [01-07, 01-08, soft-dep-probe, prd]

actuals:
  tokens: 5300
  tasks: 2
  commits: 1
plan_head_before: e571ac67a300e7b2030686a71de832881e1f84bd
plan_head_after: 93bfa09ac9f49fcf9a3b80c005074d6abcb79abd

tech-stack:
  added: []
  patterns:
    - "An e2e soft-dep case runs install and then `list --scope project` through the same registered command, and compares the whole trailing reasons block of the plugin's installed row"

key-files:
  created: []
  modified:
    - tests/e2e/install-soft-deps.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - docs/prd/pi-claude-marketplace-prd.md

key-decisions:
  - "The e2e soft-dep matrix runs one install-and-list case per detection state and compares the whole reasons block of the plugin's installed row, so a missing row or an extra reason fails the case"

patterns-established:
  - "rowReasons(messages, plugin) returns the trailing `{...}` block of the `  ● <plugin> ` row, `\"\"` for a row with no block, and `undefined` when the row is missing"

# ADET-01 and ADET-02 are also delivered by plans 01-07 (info line) and 01-08
# (real-Pi RPC proof), so this plan marks neither.
requirements-completed: []

coverage:
  - id: D1
    description: "Each of the six pi-mcp-adapter detection states installs context7 and lists it through the real extension; adapter loaded, command only and fork install leave both rows without a reasons block, and built-in only, neither and a foreign mcp tool put {requires pi-mcp-adapter} on both rows"
    requirement: ADET-02
    verification:
      - kind: e2e
        ref: "node --test tests/e2e/install-soft-deps.test.ts (tmp/p06-t2-verify.log: 8 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The PRD soft-dependency definition, RH-4 and the section 9.3 diagram state the command-or-source rule, and no PRD line keeps the tool-name `mcp` rule"
    requirement: ADET-02
    verification:
      - kind: other
        ref: "rg -n \"tool name .mcp.|name == 'mcp'\" docs/prd/pi-claude-marketplace-prd.md (no output)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 06: e2e adapter detection matrix and PRD rule Summary

**Every pi-mcp-adapter detection state now runs through install and list on the real
extension, on the e2e mock Pi. Each case compares the whole reasons block of the installed
row in both outputs. The PRD states the ADET-02 rule in its definition, in RH-4 and in the
§9.3 probe diagram.**

## Performance

- **Duration:** about 35 min, plus the pre-commit run
- **Started:** 2026-10-02T20:39:43Z
- **Completed:** 2026-10-02
- **Tasks:** 2 (Task 1 is a tracer)
- **Files modified:** 4 (3 test, 1 doc)
- **Node:** v26.10.0

## Accomplishments

- `tests/e2e/install-soft-deps.test.ts` is rebuilt around typed `SoftDepState` rows
  `{ requirement, name, tools, commands, reasons }`. Every inventory comes from
  `tests/platform/pi-inventory-seed.ts`. Each row is its own `test()`.
- `installAndList` installs the plugin with `installTargetWithMockPi(env, plugin, tools,
  commands)`. It then runs `list --scope project` through `mock.commands.get("claude:plugin")`
  with the same `ctx`.
- `rowReasons` finds the `  ● <plugin> ` row and returns its trailing `{...}` block. It returns
  `""` for a row with no block and `undefined` when the row is missing. Each case compares
  that value with the row's expected block (`""`, `{requires pi-mcp-adapter}` or
  `{requires pi-subagents}`). A missing row, a different marker, or an extra reason fails the
  case. The test never matches an open-ended substring (D-01-02).
- The MCP rows also check that `mcp.json` holds every recorded server. The agents rows check
  that every generated agent file carries `pi-claude-marketplace`.
- `install-flow.test.ts`: the section header and the test title now say `PI-12 / ADET-02` and
  name the condition (staged MCP servers, no `mcp-adapter` command, no adapter source).
- `uninstall.test.ts`: the MSG-SD-3 comment says the double lacks the `subagent` tool and the
  `mcp-adapter` command.
- PRD (D-01-20):
  - The "Soft dependency" definition says the probes read tool and command registration. It
    says pi-mcp-adapter is found by its `mcp-adapter` command, or by a command or tool whose
    `sourceInfo.source` contains `pi-mcp-adapter`.
  - RH-4 states the rule: an extension command `mcp-adapter` in `pi.getCommands()`, or
    `mcp-adapter:<n>` when Pi suffixes a twice-registered name, or any command or tool source
    containing `pi-mcp-adapter`. A tool named `mcp` alone does not count, and Pi's built-in MCP
    does not count either.
  - The §9.3 flowchart reads `pi.getAllTools()` and `pi.getCommands()`. Its MCP edges carry the
    command-name and source conditions, and a "no arm matches" edge leads to the warning.
    mdformat re-padded the §6.8 table.

## e2e case list (`tmp/p06-t2-verify.log`)

| Case | Result |
| --- | --- |
| ADET-02: the adapter's proxy tool and command clear {requires pi-mcp-adapter} on context7's install and list rows | pass |
| ADET-02: the adapter's command alone (disableProxyTool) clears {requires pi-mcp-adapter} on context7's install and list rows | pass |
| ADET-02: a fork's mcp-adapter command clears {requires pi-mcp-adapter} on context7's install and list rows | pass |
| ADET-01: Pi's built-in MCP alone keeps {requires pi-mcp-adapter} on context7's install and list rows | pass |
| ADET-01: no adapter and no built-in MCP keeps {requires pi-mcp-adapter} on context7's install and list rows | pass |
| ADET-01: a foreign extension's mcp tool keeps {requires pi-mcp-adapter} on context7's install and list rows | pass |
| RH-3: a subagent tool clears {requires pi-subagents} on code-simplifier's install and list rows | pass |
| RH-3: no subagent tool keeps {requires pi-subagents} on code-simplifier's install and list rows | pass |

`ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

## Task Commits

1. **Tasks 1 and 2 (one commit, as the plan specifies)** - `93bfa09a`
   (`test(e2e): run every adapter detection state through install and list`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, state.json).

The code commit SHA was fixed before the pre-commit run, as in earlier plans. The commit object
was built with `git commit-tree` from a temporary index holding HEAD plus the four changed
files (tree `5a4338e2`), with author and committer dates pinned to
`2026-10-02T21:30:00+0000`. `git commit` then uses the same tree, parent, dates and message.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

- **Tracer (Task 1)** (`tmp/p06-t1-verify.log`, `T1_EXIT=0`): the fork-install row alone
  passed through install and list. That verify ran after all Task 1 work, so Task 2 started.
  `workflow.auto_advance` is false and the verify is automated-only, so no checkpoint was
  needed.
- **Task 2** (`tmp/p06-t2-verify.log`, `T2_EXIT=0`): `node --test
  tests/e2e/install-soft-deps.test.ts` (8 pass, 0 fail), then `node --test
  tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/uninstall.test.ts`
  (324 pass, 0 fail).
- **Lint:** `npx eslint` on the three test files exits 0. Prettier reports all three formatted.
- **Fallow audit** (`fallow audit --format json --quiet --explain --gate-marker agent`,
  `tmp/p06-fallow-audit.json`): verdict `pass`.
- **Pre-commit:** one run covers the code commit and the docs commit, per the operator's
  pay-once rule: `TMPDIR=/var/tmp/mcp4-p06 SKIP=trufflehog pre-commit run --files <4 code
  paths + SUMMARY, STATE.md, ROADMAP.md, state.json>`, log `tmp/p06-precommit.log`. The tests/e2e
  change adds `npm run test:e2e` to the full scope. `git commit` runs only after that log ends
  with `PRECOMMIT_EXIT=0`. A failed hook means no commit.

### Acceptance checks

- `rg -n 'forkAdapterCommand\(\)' tests/e2e/install-soft-deps.test.ts`: the fork row.
- `rg -n -F '{requires pi-mcp-adapter"' tests/e2e/install-soft-deps.test.ts`: no output.
- `rg -n "tool name .mcp.|name == 'mcp'" docs/prd/pi-claude-marketplace-prd.md`: no output.
- `grep -n 'mcp-adapter' docs/prd/pi-claude-marketplace-prd.md`: lines 122 (definition), 629
  (RH-4) and the §9.3 flowchart edges.
- `rg -n 'PI-12 / RH-4' tests/orchestrators/plugin/install-flow.test.ts`: no output.

## Files Created/Modified

- `tests/e2e/install-soft-deps.test.ts` - typed state rows, `installAndList`, `rowReasons`;
  six MCP cases and two agents cases
- `tests/orchestrators/plugin/install-flow.test.ts` - section header and test title restated
- `tests/orchestrators/plugin/uninstall.test.ts` - MSG-SD-3 comment restated
- `docs/prd/pi-claude-marketplace-prd.md` - definition, RH-4, §9.3 flowchart

## Decisions Made

- Each case compares the whole trailing reasons block of the installed row, not a substring of
  the message. With a single companion declared, that block is either empty or exactly one
  closed token, so the comparison is exact.
- The context7 version token is a content hash that changes on the nightly `main` run, so the
  case locates the row by its `  ● context7 ` prefix and does not compare the whole row.

## Deviations from Plan

### Other adjustments

- **On-disk assertions run in every row of an axis.** The plan says to keep them "in one row
  per plugin". Every MCP row installs context7 and every agents row installs code-simplifier,
  so each row checks its own plugin's on-disk result. Picking one row would have needed a
  conditional in the loop body, which the unit-testing rules forbid.
- **Row fields.** The plan names `{ name, tools, commands, adapterLoaded }`. The rows carry
  `requirement` and the expected `reasons` block in place of `adapterLoaded`. The title then
  cites ADET-01 or ADET-02 from the row, and the expected value is a literal with no
  conditional.
- **The agents rows cite RH-3**, the pi-subagents detection rule, since ADET-01 and ADET-02
  cover only the MCP adapter.
- **State verbs.** `state.advance-plan`, `state.record-metric`, `state.add-decision` and
  `state.record-session` ran, and `state.update-progress` and
  `roadmap.update-plan-progress` ran after the SUMMARY existed. They left
  `last_activity_desc` and the Current Position "Last activity" line naming 01-05, and the
  frontmatter `completed_plans` at 5, so those three lines were hand-edited.

None of these change the plan's scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-07 (info line) and plan 01-08 (real-Pi RPC test) share no files with this plan.
- ADET-01 and ADET-02 stay open in REQUIREMENTS.md until plans 01-07 and 01-08 land.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-01-SC: accepted. This plan installs no package.
- T-01-19: mitigated. Every MCP row compares the whole reasons block on both the install row
  and the list row. The foreign `mcp` tool row expects `{requires pi-mcp-adapter}`, so a false
  all-clear fails that case.

## Self-Check: PASSED

- `tests/e2e/install-soft-deps.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`,
  `tests/orchestrators/plugin/uninstall.test.ts` and `docs/prd/pi-claude-marketplace-prd.md`
  exist with the changes above.
- `93bfa09a` exists as a commit-tree object (`git cat-file -t` reports `commit`). `git commit`
  makes it HEAD~1 of the docs commit only after `tmp/p06-precommit.log` ends with
  `PRECOMMIT_EXIT=0`.
