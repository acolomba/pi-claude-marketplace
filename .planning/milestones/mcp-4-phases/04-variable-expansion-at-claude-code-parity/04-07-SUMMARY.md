---
phase: 04-variable-expansion-at-claude-code-parity
plan: 07
subsystem: info
tags: [info, mcp, variables, closed-catalog]

requires:
  - phase: 04-03
    provides: "expandClaudeValue(raw, fieldClass, env, builtins) with ExpandedValue.withheld and the deny arm"
  - phase: 04-04
    provides: "the info mcp line with left-out servers and their unsupported feature"
provides:
  - "domain/claude-mcp-variables.ts: ServerVariableScan and scanClaudeServerVariables(server, env)"
  - "McpServerSummaryEntry.unsetVariables and withheldVariables, rendered by appendMcpLine through mcpEntryText"
  - "createGetPluginInfo(reader, env = process.env); env threaded to composeResolvedComponents; composeMcpEntries(..., scans)"
  - "Catalog state installed-with-mcp-variables with its fixture (266 states, 40_785 bytes)"
affects: [04-08, 04-09]

actuals:
  tokens: 10703
  tasks: 2
  commits: 1
plan_head_before: dee9d9cadeb914822021699d3acec02e37f6ca25
plan_head_after: b645d820f3570fd035009c6aa41ca46d67fb2182

tech-stack:
  added: []
  patterns:
    - "The info command takes its environment at construction, so a case injects an explicit map and production binds Pi's process environment once"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/domain/claude-mcp-variables.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat/fixtures/plugin-info.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts

key-decisions:
  - "info scans a server's raw config by Claude's type: no type or stdio scans command, args and env (not under CLAUDE_PLUGIN_ROOT or CLAUDE_PLUGIN_DATA) as plain; sse, http and streamable-http scan url and headers as remote; any other type or a non-object gives two empty lists"
  - "The scan gives every builtin an empty path, so a builtin token is never listed"
  - "The mcp entry renders as <name> (unset A, B; withheld C); each part shows only when its list is non-empty, and a left-out server shows only (unsupported <feature>) (closed-catalog draft for operator review)"

patterns-established:
  - "A data row table that spans two requirements carries a requirement field, so the title cites the right ID without duplicating the case body"

requirements-completed: []

coverage:
  - id: D1
    description: "scanClaudeServerVariables lists unset and withheld names over Claude's five fields, names only, deduplicated, no builtin"
    requirement: AVAR-04
    verification:
      - kind: unit
        ref: "tests/domain/claude-mcp-variables.test.ts (describe scanClaudeServerVariables, 10 rows)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "appendMcpLine renders unset, withheld, both, unsupported and bare entries on one mcp line"
    requirement: AVAR-04
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#AVAR-04: renders each server's variable lists, its unsupported feature, or its bare name"
        status: pass
    human_judgment: false
  - id: D3
    description: "info computes the lists from the injected environment end to end, never prints a value, and leaves left-out servers and the record arm without lists"
    requirement: AVAR-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#AVAR-04: info lists an MCP server's unset variables and withheld credentials from the current environment"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts (AVAR-04 left-out, bare-name, :- default and installation-record cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The catalog documents installed-with-mcp-variables, byte-pinned by its fixture"
    requirement: AVAR-04
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 21 fixture modules to 266 exact documented states"
        status: pass
    human_judgment: false
  - id: D5
    description: "The mcp line wording and the catalog prose read well to a user (closed-catalog draft)"
    requirement: AVAR-04
    verification: []
    human_judgment: true
    rationale: "The plan marks the wording as a closed-catalog draft for operator review; tests pin the bytes, not their clarity"

duration: 15min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 07: info shows MCP server variables Summary

**`/claude:plugin info` now lists, for each plugin MCP server the plugin writes, the referenced variables that are unset with no `:-` default and the deny-listed ones withheld, as `plugin:<plugin>:<server> (unset A, B; withheld C)`, computed from the environment injected into the info command (Pi's process environment in production), names only and with no network.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-07T18:19Z
- **Completed:** 2026-10-07T18:34Z
- **Tasks:** 2 (one commit, as the plan directs)
- **Files modified:** 11

## Accomplishments

- `domain/claude-mcp-variables.ts`: `ServerVariableScan` and `scanClaudeServerVariables(server, env)`. It picks Claude's fields by `type`, runs each string through `expandClaudeValue` with empty builtins, and returns the deduplicated first-seen `missing` names as `unset` and all withheld names as `withheld`.
- `shared/notification-types.ts`: `McpServerSummaryEntry.unsetVariables` and `withheldVariables`, optional, documented as names only and non-empty when present.
- `shared/notification-grammar.ts`: `appendMcpLine` maps entries through the private `mcpEntryText`; a left-out server keeps `(unsupported <feature>)`, otherwise `unset ...` and `withheld ...` join with `; ` in one pair of parentheses.
- `orchestrators/plugin/info.ts`: `createGetPluginInfo(reader, env = process.env)`; `env` is a required field or parameter from `getPluginInfoWithReader` through `buildBlock` and every row builder that reaches `composeResolvedComponents(reader, env, ...)`. The resolved arm builds a scan map from `Object.entries(resolved.mcpServers)`; `composeMcpEntries` spreads the lists only when non-empty. Dropped servers and the record arm get no scan. No other read of the process environment in the module.
- `docs/output-catalog.md`: state `installed-with-mcp-variables` after `partially-available-with-unsupported-mcp`, with its fixture. The info section's opening paragraph does not list the `mcp` line's suffixes, so it is unchanged.

## Task Commits

The plan ships as one commit.

1. **Task 1: tracer, info shows both lists on the mcp line end to end** - `b645d820`
2. **Task 2: scan, rendering and info arms pinned, catalog state, the commit** - `b645d820` (feat)

Tracer gate: `workflow.auto_advance` is false, `workflow.human_verify_mode` is the default `end-of-phase`, and the tracer `<verify>` is automated-only, so it was re-run (exit 0, 3 pass) and execution expanded with no checkpoint.

## Verification

Node v26.10.0. All commands from the repo root.

| Command | Exit | Notes |
|---|---|---|
| Task 1: `mkdir -p /var/tmp/mcp4-p4-07 && npm run typecheck && TMPDIR=/var/tmp/mcp4-p4-07 node --test --test-name-pattern="^(AVAR-04\|constructs the info command\|ANAME-07)" tests/orchestrators/plugin/info.test.ts` | 0 | 3 pass before Task 2; 7 pass rerun on `b645d820` (the Task 2 AVAR-04 cases match the pattern) |
| Task 2 verify 1: `npm run typecheck && node --test <domain, grammar, catalog-contract> && node --test tests/orchestrators/plugin/info.test.ts && npm run test:coverage:direct -- <3 sources>` | 0 | rerun on `b645d820`: 174 pass; 201 pass; 100% direct coverage for all three sources |
| Task 2 verify 2: `TMPDIR=/var/tmp/mcp4-p4-07 npm run test:modules && npm run test:architecture && test "$(tail -n 1 tmp/p4-07-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | run on `b645d820`; printed `feat(info): show the unset and withheld variables of plugin MCP servers` |
| `npx fallow audit --base dee9d9ca` | 0 | No issues in 11 changed files; 3 inherited clone groups excluded by the gate |
| `npx fallow dead-code` | 0 | No issues; `scanClaudeServerVariables` and `ServerVariableScan` have production consumers |
| D-04 ID check on `git diff dee9d9ca..HEAD -- extensions tests` | 0 | no `D-04-NN` added |
| `TMPDIR=/var/tmp/mcp4-p4-07 node --test tests/integration/mcp-variable-expansion.test.ts` | 0 | extra check: 2 pass |

- Pre-commit log `tmp/p4-07-precommit.log` ends with `PRECOMMIT_EXIT=0`. The first run failed markdownlint MD038 on a `` `; ` `` code span in the catalog prose; the prose now says "separated by a semicolon", and the rerun was clean.
- Commit `b645d820` hook: `npm run check:commit....Passed` (all pairs, because the catalog fixture is staged test support); gitlint Passed.
- New `EXPECTED_UTF8_BYTES`: `40_785` (40_571 plus 214), `EXPECTED_STATE_COUNT = 266`.
- Other suites fixed: `tests/architecture/catalog-uat/catalog-parser.test.ts` pins the catalog tuple count (265 -> 266, title and assertion).

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- The scan reads `type === undefined` as stdio; a `null` or other non-string `type` expands no field, as does `ws` or a host-only type.
- `composeMcpEntries` builds written and left-out entries in two maps and sorts once, which drops the `"feature" in entry` test.
- `mcpEntryText` still guards an empty list, though info never stamps one, because the type allows it; a grammar row pins the bare-name result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A second suite pins the catalog state count**
- **Found during:** Task 2 step 7 (`npm run test:architecture`)
- **Issue:** `tests/architecture/catalog-uat/catalog-parser.test.ts` asserts 265 parsed catalog tuples. File not in `files_modified`.
- **Fix:** 266 in the assertion and the title.
- **Files modified:** tests/architecture/catalog-uat/catalog-parser.test.ts
- **Committed in:** b645d820

**2. [Rule 1 - Doc accuracy] The contract test title named the old count**
- **Found during:** Task 2 step 6
- **Issue:** the case title said `265 exact documented states`.
- **Fix:** the title says 266.
- **Committed in:** b645d820

**3. [Test structure] `describe("expandClaudeValue")` around the existing rows**
- The domain module now has two exported entrypoints, so its existing row loop sits in `describe("expandClaudeValue")` beside the new `describe("scanClaudeServerVariables")`, per the unit-testing skill. No row changed.

**4. [Test structure] Grammar row table gains a `requirement` field**
- The existing `ANAME-07` mcp rows and the new `AVAR-04` rows share one loop, so no case body is duplicated; existing titles are unchanged.

**5. [Process] TDD order**
- The plan's Task 1 tracer writes the implementation first and Task 2 pins it, so no RED run was recorded for Task 2's rows. `workflow.tdd_mode` is false and the plan ships one commit.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 doc accuracy) plus 3 recorded structure and process notes. **Impact:** no scope change; behavior matches the plan.

## Issues Encountered

- None beyond the deviations above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-20 is mitigated: the scan returns names only, and the tracer case sets `ANTHROPIC_API_KEY` to a sentinel and asserts no notification contains it. T-04-21 is mitigated: the scan is pure domain code over the injected map, and info stays read-only and network-free (BLOCK F still lints `orchestrators/plugin/info.ts`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 04-08. AVAR-04 and AVAR-05 stay pending: 04-08 declares AVAR-05 and 04-09 declares AVAR-04.

## Self-Check: PASSED

- FOUND: every modified file listed in key-files
- FOUND: commit b645d820 on HEAD
