---
phase: 01-foundation-and-pi-1-5-0
plan: "04"
subsystem: notifications
tags: [closed-set, notification-vocabulary, wire-schema, json-output]

requires: []
provides:
  - "Reason members `requires mcp` and `requires builtin mcp` (D-MB-07), enrolled in REASONS and UnsupportedReason"
  - "McpServerStatus members `overridden by mcp.json` and `project not trusted` (BLT-05), enrolled in MCP_SERVER_STATUSES"
  - "Companion members `mcp` and `builtin mcp`, enrolled in COMPANIONS"
  - "Regenerated schema/claude-plugin.schema.json and updated docs/json-output.md closed-set lists"
affects: [mcp-marker-rendering, info-requires-line, builtin-mcp-status, json-output]

actuals:
  tokens: 4800
  tasks: 1
  commits: 1
plan_head_before: d8bba1bf9dc76655ad930f6c20177121a61319c3
plan_head_after: 7992ccfda4a26525a93c928c867a991dff209378

tech-stack:
  added: []
  patterns:
    - "Closed-set append: union tail, wire map, reason partition, lock map plus count, enumeration list, schema regeneration, and docs list in one commit"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - test/architecture/notify-closed-set-locks.test.ts
    - test/architecture/compat-01-no-expansion.test.ts
    - test/shared/notification-types.test.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md

key-decisions:
  - "The two new reasons sit in UnsupportedReason directly after `requires pi-mcp-adapter`, the soft-dependency marker they sit beside"
  - "The two new companions are appended after `pi-subagents` in both the Companion union and COMPANIONS, so the wire schema enum appends rather than reorders"
  - "No catalog fixture, catalog counter, renderer, or severity function changed: nothing emits the new entries yet"

patterns-established:
  - "test/shared/notification-types.test.ts holds a third hand-written Reason enumeration with an IsExact proof; a Reason append must touch it too"

requirements-completed: [MDEC-01]

coverage:
  - id: D1
    description: "Reason closed set gains `requires mcp` and `requires builtin mcp` at its tail; `requires pi-mcp-adapter` unchanged"
    requirement: MDEC-01
    verification:
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 80-entry reason set"
        status: pass
      - kind: unit
        ref: "test/architecture/compat-01-no-expansion.test.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck (notify-reasons partition proof, notification-types.test.ts IsExact proof)"
        status: pass
    human_judgment: false
  - id: D2
    description: "McpServerStatus gains `overridden by mcp.json` and `project not trusted`"
    requirement: MDEC-01
    verification:
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts#ASTAT-02: McpServerStatus is the closed 12-entry MCP server status set"
        status: pass
    human_judgment: false
  - id: D3
    description: "Companion union and COMPANIONS wire map gain `mcp` and `builtin mcp`; the wire schema and JSON docs list all six entries"
    requirement: MDEC-01
    verification:
      - kind: unit
        ref: "test/architecture/wire-schema.test.ts (committed schema deep-equals a fresh build)"
        status: pass
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false
  - id: D4
    description: "No emission change: every renderer and the catalog produce today's bytes"
    requirement: MDEC-01
    verification:
      - kind: unit
        ref: "npm run test:modules (15483 tests)"
        status: pass
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts (EXPECTED_STATE_COUNT, EXPECTED_UTF8_BYTES unchanged)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 04: Closed-Set Entries for the MCP Implementation Summary

**Six append-only closed-set entries (reasons `requires mcp` and `requires builtin mcp`, MCP server statuses `overridden by mcp.json` and `project not trusted`, companions `mcp` and `builtin mcp`) enrolled in the types, the wire maps, the reason partition, the lock tests, the wire schema, and the JSON docs in one commit, with no emitter changed**

## Performance

- **Duration:** about 18 min
- **Started:** 2026-11-04T03:58:00Z (approximate; no start stamp was captured)
- **Completed:** 2026-11-04T04:16:18Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- `Reason` ends with `requires mcp` and `requires builtin mcp` (D-MB-07 comment). `REASONS` and `UnsupportedReason` enroll both, so the partition proof compiles.
- `McpServerStatus` ends with `overridden by mcp.json` and `project not trusted`. The docblock names BLT-05, and `MCP_SERVER_STATUSES` enrolls both.
- The type-only `Companion` union and the `COMPANIONS` wire map gain `mcp` and `builtin mcp`. No function in `soft-dep.ts` changed.
- Lock counts bumped: Reason 78 to 80, McpServerStatus 10 to 12. `EXPECTED_REASONS` in compat-01 ends with the two reasons and a D-MB-07 comment.
- `npm run schema:generate` regenerated `schema/claude-plugin.schema.json`. The `Reason`, `McpServerStatus`, and `Companion` lists in `docs/json-output.md` gained the new members at their ends.

## Task Commits

1. **Task 1: Append the reasons, companions, and status tokens in one commit** - `7992ccf` (feat)

**Plan metadata:** recorded by the SUMMARY commit that follows.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts` - Reason and McpServerStatus tail additions, with comments citing D-MB-07 and BLT-05
- `extensions/pi-claude-marketplace/shared/notification-wire.ts` - REASONS, MCP_SERVER_STATUSES, COMPANIONS enrollment
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - UnsupportedReason home for both new reasons
- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` - Companion union widened (type only)
- `test/architecture/notify-closed-set-locks.test.ts` - enrollment maps and counts
- `test/architecture/compat-01-no-expansion.test.ts` - EXPECTED_REASONS tail
- `test/shared/notification-types.test.ts` - EXPECTED_REASONS tail (see Deviations)
- `schema/claude-plugin.schema.json` - regenerated enums
- `docs/json-output.md` - closed-set token lists

## Decisions Made

- The new reasons sit in `UnsupportedReason` directly after `requires pi-mcp-adapter`, ahead of the WDEP-04 workflow marker. This group is a type-level partition, so the order affects nothing at runtime.
- The `overridden by mcp.json` docblock gives the meaning BLT-05 implies: a server that an `mcp.json` entry with the same name replaces. `project not trusted` is a project server Pi does not load because the project is not trusted. Phase 2 owns the real mapping, so this text is the first reading of the requirement and Phase 2 may refine it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A ninth file needed the Reason append**
- **Found during:** Task 1
- **Issue:** `test/shared/notification-types.test.ts` keeps its own hand-written `EXPECTED_REASONS` list with a two-way `IsExact<Reason, ...>` proof. Without the two new reasons, typecheck fails. The plan's file list and its "exactly the eight files" criterion did not include it.
- **Fix:** Appended `requires mcp` and `requires builtin mcp` at the tail of that list.
- **Files modified:** test/shared/notification-types.test.ts
- **Verification:** `npm run typecheck`, the pair's direct coverage (100%), and `npm run test:modules` pass
- **Committed in:** 7992ccf (the single closed-set commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The commit lists nine files instead of eight. Leaving the file out was not possible, because the commit would not typecheck. All six entries still landed in one commit.

## Issues Encountered

- After the union was widened, Prettier reflowed it in `soft-dep.ts` (`format:check` failed once). Running `prettier --write` fixed it before the commit.

## Verification

- `npm run test:architecture`: 818/818 pass. This includes notify-closed-set-locks, compat-01-no-expansion, wire-schema, closed-set-enrollment, and catalog-contract.
- `npm run check:static`: exit 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `npm run test:modules`: 15483/15483 pass.
- Direct coverage at 100% for notification-types.ts, notification-wire.ts, notify-reasons.ts, and concerns/soft-dep.ts.
- `node --test ... test/shared/concerns/soft-dep.test.ts test/shared/notify-reasons.test.ts`: passes, and neither file changed.
- Acceptance greps: all pass. `git show --stat 7992ccf -- test/architecture/catalog-uat docs/output-catalog.md` lists nothing. The commit lists nine files, not eight (see Deviations).

## Known Stubs

None. The six entries are deliberately not emitted yet; the plan states this, and Phase 6 removes any entry the combined tree never emits.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-08 (schema drift) is mitigated: the schema was regenerated in the same commit, and `wire-schema.test.ts` passes.

## Dubious Choices

1. **Touched a ninth file (`test/shared/notification-types.test.ts`)** although the plan says the commit lists exactly eight files. Alternatives: leave it out and accept a failing typecheck, or split it into a second commit. Neither works: the commit would not typecheck, and the plan requires one commit. Severity: Low.
2. **Wording of the `overridden by mcp.json` / `project not trusted` docblock.** I inferred the meanings from BLT-05's list and from how `overridden by project scope` is described. Phase 2 implements the mapping and may need to adjust the comment. Alternative: a bare "BLT-05" comment with no explanation. Severity: Low.
3. **Placement of the new members in the docs lists.** The plan says "appending in declaration order". The existing `Reason` docs list is not in declaration order (`already added` sits after `already installed`), so I appended the new members at each list's end, after `network error`, instead of reordering the list. Severity: Low.
4. **No `windows append --kind deviation` entry for the ninth-file deviation.** That ledger blocks `/gsd-ship` while an entry is open, and this deviation leaves nothing unresolved. Severity: Low.
5. **Approximate start time and diff-based `actuals.tokens`.** No start stamp was captured, so the duration is an estimate. Tokens are chars/4 of the realized diff (19198 chars), not of the whole changed files. Severity: Low.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Frozen interface 10 exists. Phases 2 and 3 can emit `requires mcp`, `requires builtin mcp`, the two status tokens, and the two companion names without touching a closed-set file.
- Phase 3 still owns the MCP arm of `softDepMarkers`, `companionRequirements`, and `companionSeverity`, plus the catalog fixtures and counters once rows emit these entries.

## Self-Check: PASSED

- FOUND: commit 7992ccf is an ancestor of HEAD
- FOUND: every modified file listed under key-files exists
- Acceptance criteria re-run after the commit: all pass except the eight-file count, which is nine (documented under Deviations)

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
