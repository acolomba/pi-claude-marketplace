---
phase: 06-release-docs-and-combined-tree
plan: "07"
subsystem: docs
tags: [output-catalog, json-output, mcp, d-mb-07, catalog-contract, closed-sets]

requires:
  - phase: 03-read-time-verdicts
    provides: "the D-MB-07 name table (`mcp`, `pi-mcp-adapter`, `builtin mcp`) that info and list render"
  - phase: 02-built-in-materialization
    provides: "the built-in MCP status stamps (`overridden by mcp.json`, `project not trusted`)"
provides:
  - "nine catalog `requires:` lines and their fixture literals that name `mcp`, with the byte counter at 54553"
  - "catalog prose for the three MCP markers, the D-MB-07 rule, per-implementation feature wording, and the built-in status table"
  - "JSON reference wording for `requires`, `companion`, `unsupportedFeature`, `status`, and the per-implementation token paragraph"
  - "the closed-set emitter table (D-P6-20: no entry removed)"
affects: [06-release-docs-and-combined-tree wave gate, CHANGELOG, mcp-builtin milestone audit]

actuals:
  tokens: 10060
  tasks: 3
  commits: 2
plan_head_before: 37f1cfdb09cf4cd77d4b1a8f6ff7de6358b8480f
plan_head_after: d3434437c8e9c6f14b9c8a8a887dec695401ed1a

tech-stack:
  added: []
  patterns:
    - "catalog byte contract: block, fixture literal, and EXPECTED_UTF8_BYTES change in one commit"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - docs/json-output.md
    - test/architecture/catalog-uat/fixtures/plugin-info.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts

key-decisions:
  - "All nine `requires: pi-mcp-adapter` blocks become `mcp`, because every written server in them is stdio or http (D-P6-19)"
  - "Pi's built-in MCP states are a table and prose beside the adapter table, with no new catalog state (D-P6-26)"
  - "No closed-set entry is removed; all six have an emitter and an observing scenario (D-P6-20)"

patterns-established:
  - "Describe an MCP server feature by the implementation that cannot run it, or say 'the active MCP implementation cannot run' where the row depends on it"

requirements-completed: [MDOC-02]

coverage:
  - id: D1
    description: "Nine catalog `requires:` lines and fixture literals name `mcp`; contract at 324 states and 54553 bytes"
    requirement: MDOC-02
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 22 fixture modules to 324 exact documented states"
        status: pass
      - kind: other
        ref: "grep -cE '^    requires: .*pi-mcp-adapter' docs/output-catalog.md (0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Catalog and JSON reference prose for the three MCP markers, both implementations' features, and both implementations' server states"
    requirement: MDOC-02
    verification:
      - kind: unit
        ref: "npm run test:unpaired (json-output-docs, partial-vocabulary-guard, catalog contract)"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy and readability against the D-MB-07 table and the built-in status semantics need a reviewer's read"
  - id: D3
    description: "Every candidate closed-set entry keeps an emitter and a scenario; lock counts stay 80 and 12"
    requirement: MDOC-02
    verification:
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-04
status: complete
---

# Phase 6 Plan 07: Output catalog for MCP companions Summary

**The output catalog and the JSON reference now show the D-MB-07 `mcp` companion in nine byte-locked blocks (54652 to 54553 bytes, 324 states), name the three MCP markers and their rule, and map Pi's built-in MCP states in a second status table. All six closed-set entries are confirmed in use.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-11-04T23:26:40Z
- **Completed:** 2026-11-04T23:48:30Z
- **Tasks:** 3 (2 with commits, 1 read-only)
- **Files modified:** 4

## Accomplishments

- The nine `requires:` blocks render `mcp`, with fixture literals in name order and `EXPECTED_UTF8_BYTES = 54_553` (`EXPECTED_STATE_COUNT` stays 324).
- The catalog names `requires mcp`, `requires pi-mcp-adapter`, and `requires builtin mcp`, the D-MB-07 rule, and the empty edge (a plugin whose every server both implementations block gets no MCP marker and no MCP entry).
- Each MCP server feature is described by the implementation that cannot run it: both block `ws`, the host-only types, `headersHelper`, a truthy `oauth.xaa`, and a leading `~`; only built-in blocks `sse`; only pi-mcp-adapter blocks `bareElicitationCapability: true`.
- A built-in status table sits after the adapter table and its notes, with the check order of `info-mcp-status.ts` (BLT-05), and a sentence that no implementation gives `status unknown`.
- `docs/json-output.md` words `requires`, `companion`, `unsupportedFeature`, and `status` for both implementations and adds a paragraph on the tokens each emits. The token lists are unchanged.

## Task Commits

1. **Task 1: requires lines show the D-MB-07 entry, byte for byte with fixtures** - `7b04f94` (docs)
2. **Task 2: markers and both implementations' server states** - `d343443` (docs)
3. **Task 3: closed-set emitter check** - no commit (read-only; table below)

## The nine blocks

| Catalog line | State | Old line | New line | Fixture line |
| ------------ | ----- | -------- | -------- | ------------ |
| 3171 | `installed-with-missing-companion` | `requires: pi-mcp-adapter (missing), pi-subagents` | `requires: mcp (missing), pi-subagents` | 86 |
| 3187 | `installed-with-every-companion` | `requires: pi-dynamic-workflows (missing), pi-mcp-adapter, pi-subagents` | `requires: mcp, pi-dynamic-workflows (missing), pi-subagents` | 113-117 (reordered) |
| 3427 | `partially-available-with-unsupported-mcp` | `requires: pi-mcp-adapter` | `requires: mcp` | 533 |
| 3441 | `installed-with-mcp-variables` | `requires: pi-mcp-adapter` | `requires: mcp` | 563 |
| 3455 | `partially-installed-with-mcp-status` | `requires: pi-mcp-adapter` | `requires: mcp` | 593 |
| 3469 | `installed-with-mcp-pending-approval` | `requires: pi-mcp-adapter` | `requires: mcp` | 615 |
| 3483 | `installed-with-mcp-not-loaded` | `requires: pi-mcp-adapter` | `requires: mcp` | 637 |
| 3513 | `installed-both-scopes-mcp-overridden` (project) | `requires: pi-mcp-adapter` | `requires: mcp` | 695 |
| 3518 | `installed-both-scopes-mcp-overridden` (user) | `requires: pi-mcp-adapter` | `requires: mcp` | 711 |

Line numbers are as at the base commit 37f1cfd. In every block the written servers are stdio or http (the `analytics` `api` server is `type: "http"` in `test/orchestrators/plugin/info.test.ts:7665`), and the `ws` servers that a partial install leaves out are blocked by both implementations, so `runEvery` is both and the entry is `mcp`. The probe in each block other than 3171 finds pi-mcp-adapter loaded, so the entry is not missing. No block needed `pi-mcp-adapter` or `builtin mcp`.

## Closed-set emitters

| Entry | Definition | Production emitter | Observing scenario row |
| ----- | ---------- | ------------------ | ---------------------- |
| reason `requires mcp` | `extensions/pi-claude-marketplace/shared/notification-types.ts:298` (wire `shared/notification-wire.ts:164`, `shared/notify-reasons.ts:124`) | `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts:191` (`` `requires ${companion}` `` with `COMPANION_ANY_MCP`, table rows `:137`, `:152`) | `features/mcp-server/companion-missing.feature:30` |
| reason `requires builtin mcp` | `shared/notification-types.ts:299` (wire `:165`, `notify-reasons.ts:125`) | `shared/concerns/soft-dep.ts:191` with `COMPANION_BUILTIN_MCP` (table rows `:147`, `:148`, `:153`) | `features/mcp-server/companion-missing.feature:78`, `features/mcp-server/verdict-markers.feature:398` |
| status `overridden by mcp.json` | `shared/notification-types.ts:1166` (wire `:199`) | `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts:194` | `features/mcp-server/builtin-status.feature:147` (scenario at `:129`) |
| status `project not trusted` | `shared/notification-types.ts:1167` (wire `:200`) | `orchestrators/plugin/info-mcp-status.ts:211` | `features/mcp-server/builtin-status.feature:176` (scenario at `:159`) |
| companion `mcp` | `shared/concerns/soft-dep.ts:73`, `:100` (wire `shared/notification-wire.ts:207`) | `shared/concerns/soft-dep.ts:173` `mcpRequirement`, called at `:280` (table rows `:137-139`, `:152`) | `features/mcp-server/companion-missing.feature:140`, `:174` |
| companion `builtin mcp` | `shared/concerns/soft-dep.ts:73`, `:101` (wire `shared/notification-wire.ts:208`) | `shared/concerns/soft-dep.ts:173` `mcpRequirement`, called at `:280` (table rows `:147-149`, `:153`) | `features/mcp-server/verdict-info.feature:180`, `:209` |

Every entry has an emitter, so none is removed (D-P6-20). `test/architecture/notify-closed-set-locks.test.ts` passes, with `assert.strictEqual(memberCount, 80)` at `:237` and `assert.strictEqual(memberCount, 12)` at `:284` unchanged. No finding for the parent.

## Owned parent lines

| Parent line | Outcome | Commit |
| ----------- | ------- | ------ |
| 01-14 "Phase 6, closed sets" | No entry removed: all six have an emitter and a scenario (table above). No lock count, `docs/json-output.md`, or schema change. | none (record only) |
| 02-08 item 5, built-in mapping table | Applied as a second two-column table after the adapter table and its notes, with prose for each state. | `d343443` |
| 02-08 item 5, example blocks for `overridden by mcp.json` and `project not trusted` | Not added, as prose and table rows instead (D-P6-26). See P6-DC-0703. | `d343443` |
| 02-08 item 5, line 3161 `not loaded` under built-in | Not applied: that block's probe finds no MCP implementation, so the server reads `status unknown` (03-09, `companion-missing.feature:117-145`). See P6-DC-0702. | `7b04f94` |
| 02-08 item 5, json-output.md token sentence | Applied as one paragraph after the `McpServerStatus` list. | `d343443` |
| 03-09 json-output.md line 723 (`requires`) | Applied with the given text. | `d343443` |
| 03-09 json-output.md line 766 (`companion`) | Applied with the given text. | `d343443` |
| 03-09 output-catalog.md line 69 | The three MCP markers applied as given. The D-MB-07 sentence is written as an exact three-case rule. See P6-DC-0706. | `d343443` |
| 03-09 output-catalog.md line 3041 | Applied with the three given replacements; "companion extension" becomes "companion" in the lead sentence. | `d343443` |
| 03-09 output-catalog.md line 3161 (prose and rendered line) | Applied, with the reason for "no MCP implementation" named. | `7b04f94` |
| 03-09 output-catalog.md lines 3176-3188 | Applied; the prose keeps the adapter's name beside "an MCP implementation". See P6-DC-0705. | `7b04f94` |
| 03-09 fixture literals (plugin-info.ts 86, 115, 533-711) | All nine changed to `mcp`, in name order. | `7b04f94` |
| 03-09 "pi-mcp-adapter cannot run" rewording | Applied at catalog lines 63, 147, 521, 736, 3399, 3418 and json-output.md 753, 756. AMIG-01 text near 5358-5365 left as it is (D-P3-16). | `d343443` |
| Parent notes: Phase 3 lines output-catalog.md 69, 3041, 3161, json-output.md 723, 766 | Same as the rows above. | `7b04f94`, `d343443` |

## Task 2 counts

- `grep -c 'requires builtin mcp' docs/output-catalog.md`: 0 at base, 1 now.
- `grep -c "Pi's built-in MCP" docs/output-catalog.md`: 1 at base, 5 now.
- `grep -n '^`McpServerStatus`: ' docs/json-output.md`: same line text as at base.
- `git diff --stat 7b04f94..d343443 -- test/`: empty.

## Files Created/Modified

- `docs/output-catalog.md` - nine `requires: mcp` lines, the marker and companion-line rules, per-implementation feature wording, and the built-in status table.
- `docs/json-output.md` - MCP companion and status wording, and the per-implementation token paragraph.
- `test/architecture/catalog-uat/fixtures/plugin-info.ts` - nine `companion: "mcp"` literals, in name order.
- `test/architecture/catalog-uat/catalog-contract.test.ts` - `EXPECTED_UTF8_BYTES = 54_553`.

## Decisions Made

See the frontmatter `key-decisions` and the Dubious Choices below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Banned legacy phrase in the new 3161 prose**
- **Found during:** Task 1
- **Issue:** The first draft said "pi-mcp-adapter is not loaded". `test/architecture/partial-vocabulary-guard.test.ts` (D-75-01) bans that phrase repo-wide, and `test:unpaired` failed.
- **Fix:** Reworded to "pi-mcp-adapter is absent".
- **Files modified:** docs/output-catalog.md
- **Verification:** `npm run test:unpaired` exit 0
- **Committed in:** `7b04f94`

---

**Total deviations:** 1 auto-fixed (Rule 1). **Impact on plan:** wording only; no scope change.

## Issues Encountered

None.

## Checks

| Command | Exit | Duration | Sha |
| ------- | ---- | -------- | --- |
| `node --test ... catalog-contract.test.ts` (before counter) | 1 (54553 !== 54652, measured) | 1 s | working tree on 37f1cfd |
| `node --test ... catalog-contract.test.ts` | 0 | 1 s | working tree, then `7b04f94` |
| `npm run test:unpaired` (first) | 1 (vocabulary guard) | 26 s | working tree on 37f1cfd |
| `npm run test:unpaired` | 0 | 25 s | working tree, then `7b04f94` |
| `npm run lint` (warm) | 0 | 179 s | working tree, then `7b04f94` |
| `npm run check:static` | 0 | 78 s | working tree, then `7b04f94` |
| commit hook `npm run check:commit` | pass | (in commit) | `7b04f94` |
| Task 1 grep verify | 0 | <1 s | `7b04f94` |
| `pre-commit run --files docs/output-catalog.md docs/json-output.md` | 0 (after mdformat re-aligned once) | ~10 s | working tree, then `d343443` |
| `npm run test:unpaired` | 0 | 22 s | working tree, then `d343443` |
| commit hook `npm run check:commit` | pass | (in commit) | `d343443` |
| Task 2 grep verify | 0 | <1 s | `d343443` |
| `node --test ... notify-closed-set-locks.test.ts` | 0 | 1 s | `d343443` |
| Task 3 emitter grep verify | 0 | <1 s | `d343443` |

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None.

## Dubious Choices

**P6-DC-0701. All nine blocks become `mcp`, with the `analytics` transport taken from a unit test.** The fixture literals carry no transport, so I read the servers from the block prose and, for the `analytics` `api` server, from `test/orchestrators/plugin/info.test.ts:7665` (`type: "http"`). Alternatives: change only the two blocks the parent lines name (the catalog then shows a line no current code renders for seven plugins), or add a transport to the block prose. Why: D-P6-19 asks for all nine, and http is what the matching unit test uses. Severity: Low.

**P6-DC-0702. The 3161 block keeps `status unknown`, not 02-08's `not loaded`.** 02-08 item 5 says the example "now reads `not loaded` under Pi's built-in MCP". The block's probe finds no MCP implementation, and with none every server reads `status unknown` (`companion-missing.feature:117-145`). Alternatives: change the block to built-in active, which would also make its entry `mcp` not missing and break the "missing companion" point of the state. Why: 03-09 and the research table both keep `status unknown` for this block, and the built-in table now documents `not loaded`. Severity: Low.

**P6-DC-0703. No example blocks for `overridden by mcp.json` and `project not trusted`.** 02-08 item 5 asked for two example blocks. They would be new counted states (326) with new fixtures. Alternative: add them and move both counters. Why: D-P6-26 records the choice as table rows and prose only. The table says the render is the same and only the shown text differs. Severity: Low.

**P6-DC-0704. The built-in table states the check order and an extra `not loaded` cause.** The plan listed the seven states. I ordered the rows as `info-mcp-status.ts` checks them (BLT-05: project trust, then `mcp.json`, then a name another record holds, then Pi's list) and said that the first match wins. I also added that `not loaded` shows when another installation record of this extension holds the same registered name (`ownedElsewhere`, `info-mcp-status.ts:162-178`, and `docs/mcp-compatibility.md`). Alternative: the plan's list in the plan's order with no order sentence. Why: without the order, a reader cannot tell which state a server that matches two rows shows. Severity: Low.

**P6-DC-0705. The every-companion prose keeps the adapter's name.** 03-09 gives "The probe finds pi-subagents and an MCP implementation loaded". I wrote "an MCP implementation, pi-mcp-adapter, loaded", because the next sentence says "The adapter's last snapshot lists the `github` server as connected", and the fixture probe is `piWithBothLoaded` (the adapter). Alternative: the exact parent text, which leaves "the adapter" without a referent. Severity: Low.

**P6-DC-0706. The line-69 D-MB-07 sentence is an exact three-case rule.** 03-09 gives "no marker when the active implementation runs every server, otherwise the marker of the implementation that would". For the `split` shape no implementation runs every server, and with one active the table names the other one (`soft-dep.ts:151-155`), so the short text is wrong there. I wrote: no marker when the active one runs every server; with another implementation active, the marker of the one that is not active; with none active, `requires pi-mcp-adapter` or `requires builtin mcp` when only that one runs every server, and `requires mcp` otherwise. I kept 03-09's `partially-installed` sentence and added the empty-edge sentence. Alternative: the verbatim parent text. Why: the catalog states the rule the code applies. Severity: Low.

**P6-DC-0707. The 3161 prose names why no implementation runs.** I wrote that pi-mcp-adapter is absent and the user's Pi settings turn off Pi's built-in MCP. That is the setup of the matching scenario (`companion-missing.feature:117-125`). The catalog's mock probe does not model built-in MCP, and the fixture is a pre-stamped literal. Alternative: only "finds no MCP implementation". Why: Pi 1.5.0 runs its built-in MCP by default, so a reader needs to know why none runs. Severity: Low.

**P6-DC-0708. "With none active" qualifiers on the feature wording.** Where the plan said "the active MCP implementation cannot run", I added at catalog lines 736 and 3399 that with no implementation active only a feature that neither implementation runs blocks a server (the CHANGELOG parent line: "With no MCP implementation, only servers neither can run need it"). Lines 63, 147, and 521 keep the short form. Alternative: the short form everywhere, which is wrong when no implementation is active. Severity: Low.

## Next Phase Readiness

Ready for the wave gate (`npm run check`, both profiles). No blockers.

## Self-Check: PASSED

- FOUND: docs/output-catalog.md, docs/json-output.md, test/architecture/catalog-uat/fixtures/plugin-info.ts, test/architecture/catalog-uat/catalog-contract.test.ts
- FOUND: 7b04f94, d343443 (ancestors of HEAD)

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-04*
