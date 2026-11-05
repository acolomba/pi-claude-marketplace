---
phase: 06-release-docs-and-combined-tree
plan: "06"
subsystem: docs
tags: [readme, mcp, pi-builtin-mcp, pi-mcp-adapter, hooks, agents, mdoc-02]

requires:
  - phase: 02-built-in-materialization
    provides: built-in registration, names, status, and the docs/mcp-compatibility.md built-in sections
  - phase: 03-read-time-verdicts
    provides: the three MCP requires markers (D-MB-07) and the line-144 wording
  - phase: 04-agent-grants
    provides: the drafted agents text for docs/mcp-compatibility.md
  - phase: 05-hook-tool-names
    provides: the built-in hook tool-name text in docs/hooks-compatibility.md
provides:
  - README.md and README.es.md `### MCP implementations` / `### Implementaciones de MCP` sections
  - the built-in server name column and `my-db` row in both MCP naming tables
  - Pi's exact long-name cut with D-MB-13 and a second D-MB-08 citation in docs/hooks-compatibility.md
  - the built-in agent-grant text and D-MB-14 to D-MB-29 citations in docs/mcp-compatibility.md
affects: [06-10 PROJECT.md Key Decisions rows D-MB-14..29, 06-12 MDOC-02 phase gate]

actuals:
  tokens: 22838
  tasks: 3
  commits: 3
plan_head_before: 37f1cfdb09cf4cd77d4b1a8f6ff7de6358b8480f
plan_head_after: 8969c187426adcf0a12da975fb077a5be612224e

tech-stack:
  added: []
  patterns:
    - "README items that describe an MCP difference link to the docs/mcp-compatibility.md section that cites its scenario or Pi source"

key-files:
  created: []
  modified:
    - README.md
    - README.es.md
    - docs/hooks-compatibility.md
    - docs/mcp-compatibility.md

key-decisions:
  - "README marker table explains {requires mcp}, {requires pi-mcp-adapter}, {requires builtin mcp} by what the user can do, and states the no-server and unsupported-only edges"
  - "Elicitation rows name either MCP implementation, because Pi 1.5.0 dist/ has no elicitation (grep found no match)"
  - "Legacy mcp.json entries text already matches D-P3-16; left unchanged"

patterns-established:
  - "Docs cite D-MB decision IDs, never P2-DC review-log IDs (P2-DC-90, D-P6-24)"

requirements-completed: [MDOC-02]

coverage:
  - id: D1
    description: "Both READMEs say Pi's built-in MCP runs plugin servers without pi-mcp-adapter, how to turn one on, that the adapter runs when both load, what the adapter adds, the three markers, and the built-in names"
    requirement: MDOC-02
    verification:
      - kind: other
        ref: "pre-commit run --files README.md README.es.md; line/heading/table-row parity test; node section-link check (20 links, all resolve); grep of the four fixed phrases; acceptance greps"
        status: pass
    human_judgment: true
    rationale: "The greps prove the fixed words and links; whether the prose is accurate and readable in both languages needs a reader"
  - id: D2
    description: "docs/hooks-compatibility.md states Pi's exact long-name cut with D-MB-13 and cites D-MB-08 twice; the proxy rule stays scoped to pi-mcp-adapter"
    requirement: MDOC-02
    verification:
      - kind: other
        ref: "grep -q 'first 55 characters' && grep -q 'D-MB-13' && D-MB-08 count >= 2; proxy-rule grep count 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/mcp-compatibility.md carries the built-in agent-grant text, cites agent-grants.feature for the agent cases, and cites D-MB-14..29 in place of every P2-DC ID"
    requirement: MDOC-02
    verification:
      - kind: other
        ref: "P2-DC count 0; D-MB-20 present; agent-grants.feature cited 3 times; invocation.feature cited 4 times; 'with no `_` at the end' and 'mcp:plugin_foo_github' present"
        status: pass
    human_judgment: true
    rationale: "Phase 4's drafted text was adapted to the current paragraphs; a reader should confirm the placement reads correctly"

duration: 9min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 06: Release docs for built-in MCP (MDOC-02) Summary

**Both READMEs now describe Pi's built-in MCP beside pi-mcp-adapter (turn-on step, both-loaded rule, seven adapter extras plus one built-in extra, the three `requires` markers, built-in names), the hooks doc gives Pi's exact 55-character-plus-hash cut, and the MCP doc gains built-in agent grants and D-MB-14..29 citations.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-11-05T00:35:58Z
- **Completed:** 2026-11-05T00:45:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- README.md and README.es.md (same commit, 541 lines each, same heading and table-row counts): reworded MCP and agents Features bullets, pi-mcp-adapter now optional, a `Built-in server name` column and a `my-db` row in the naming table, line 144 per 03-09, and a new `### MCP implementations` (`### Implementaciones de MCP`) section with the four fixed phrases, ten links into docs/mcp-compatibility.md per file, and the marker table.
- docs/hooks-compatibility.md: the long-name rule (first 55 characters, `_`, first 8 hex digits of sha256 of `<server>` NUL `<tool>`, `dist/extensions/mcp/tools.js`, D-MB-13), D-MB-08 cited at the server segment, and the Elicitation rows name either implementation.
- docs/mcp-compatibility.md: Phase 4's agent-grant text in six places, two agent citations re-pointed to `features/mcp-server/agent-grants.feature`, and all 32 `P2-DC-` citations replaced by their D-MB IDs.

## Task Commits

1. **Task 1: Both READMEs (tracer)** - `81cc18c` (docs). Tracer feedback gate: interactive run, `end-of-phase`, verify is automated only, so the verify was re-run and passed; expansion continued with no checkpoint.
2. **Task 2: Hooks doc long-name rule** - `aa665c7` (docs)
3. **Task 3: MCP doc agent grants and decision IDs** - `8969c18` (docs)

## Files Created/Modified

- `README.md` - MCP implementations section, markers, built-in names, reworded bullets
- `README.es.md` - the same in Spanish
- `docs/hooks-compatibility.md` - exact long-name cut, D-MB-08/D-MB-13, Elicitation rows
- `docs/mcp-compatibility.md` - built-in agent grants, agent-grants.feature citations, D-MB-14..29

## Decisions Made

- Elicitation grep (Task 2 step 2): `grep -rli elicitation node_modules/@earendil-works/pi-coding-agent/dist/` (Pi 1.5.0) printed nothing, exit 1. So the no-match branch ran: both rows now say the events are blocked on pi-mcp-adapter or Pi's built-in MCP exposing the MCP request, and that Pi 1.5.0 has no elicitation.
- Legacy mcp.json entries (Task 3 step 4): the section says the same load moves the entries out of `mcp.json` in the first built-in session, which matches D-P3-16 (the AMIG-01 move runs under every implementation). No change.
- P2-DC to D-MB mapping applied exactly per the plan's context table. Cited IDs: D-MB-14..21 and D-MB-23..29. D-MB-22 (P2-DC-13) has no citation, as the table expects.
- Both agent behaviors re-pointed to agent-grants.feature are scenarios there: the foreground child without a tools list (line 280) and the foreground refusal (lines 223 and 255). The four other `invocation.feature` citations stay.

## Owned parent lines

| Parent line | Outcome | Commit |
|---|---|---|
| 01-14 SUMMARY "README.md and README.es.md" (built-in serves without the adapter; adapter wins when both loaded) | Applied in `### MCP implementations` | `81cc18c` |
| 02-08 item 2 (lines 29, 40, 126, 144 in both READMEs) | Applied; line 144 uses 03-09's wording, which supersedes 02-08's; trusted-project and `/reload` text is in the new section | `81cc18c` |
| 03-09 "README.md and README.es.md" (line 144, both languages) | Applied verbatim | `81cc18c` |
| 04-06 item 4 (docs/mcp-compatibility.md agents text, citation re-point) | Applied, adapted to the current paragraphs | `8969c18` |
| 04-06 item 6 (agents bullet sentence, both languages) | Applied, since the built-in option entered the Features list | `81cc18c` |
| 05-04 item 2 (optional hooks-doc pointer) | Applied: one sentence and a `hooks-compatibility.md#tool-name-mapping` link per README | `81cc18c` |
| D-P6-02 | Applied | `81cc18c` |
| D-P6-03 | Applied (proxy rule already scoped by Phase 5, kept) | `aa665c7` |
| 02-08 item 9, AMIG-01 part | Confirmed: "Legacy mcp.json entries" matches D-P3-16, no change | n/a |
| P2-DC-90 (docs cite decision IDs) | Applied: 0 `P2-DC-` IDs left in docs/mcp-compatibility.md | `8969c18` |

## Deviations from Plan

None - plan executed exactly as written. Judgment calls on wording and placement are listed under Dubious Choices.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06-10 must write the D-MB-14..29 Key Decisions rows into PROJECT.md, because docs/mcp-compatibility.md now cites them. Plan 06-12's MDOC-02 check can grep the four fixed README phrases.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-12: the docs keep saying resolved built-in values are readable by every extension in the process (D-MB-14). T-06-13: the READMEs say the user changes Pi settings and this extension never edits them.

## Window records

None.

## Dubious Choices

- **P6-DC-0601** (Low): The agents bullet sentence ("An agent's MCP grants follow the MCP implementation in use.") goes right after "Requires pi-subagents.", as 04-06 item 6 says, not at the end of the bullet. Alternative: append it at the end. Chosen to follow the parent line literally.
- **P6-DC-0602** (Low): The `my-db` row shows both tool-name forms in one cell, labeled "(adapter)" and "(built-in)" ("(adaptador)", "(integrado)" in Spanish, since the labels are prose). Alternative: split the Tool names column into an adapter and a built-in column. Chosen because the plan asks for one new column and "both forms" in a differing cell.
- **P6-DC-0603** (Medium): The marker table describes `{requires mcp}` as "no MCP implementation is active, and either one can run the servers of the plugin". `MCP_NAME_TABLE`'s `split` case (some servers only the adapter runs, others only built-in) also shows `requires mcp` with no implementation active, which the sentence does not cover exactly. Alternative: a fuller rule that names the split case. Chosen to keep the README short; docs/output-catalog.md (plan 06-07) holds the exact rule.
- **P6-DC-0604** (Low): The README says the marker shows on the plugin's row in `/claude:plugin list` and in the install result, not in `info`, because `info` shows it as a `requires:` line with `(missing)` (D-P6-18: `list` is the only surface that shows `{requires mcp}` on an installed plugin's row). Alternative: name `info` too. Chosen for accuracy.
- **P6-DC-0605** (Low): The README adds "Pi's built-in MCP is on unless the `extensions` of your Pi settings hold `-builtin:mcp`, an entry that pi-mcp-adapter adds", verified in Pi 1.5.0 `dist/core/package-manager.js` (built-in extensions are on unless the user `extensions` setting excludes them). The README cites no source, as is its style; the linked doc section covers the steps. Alternative: leave it to the linked doc. Chosen because the turn-on step is otherwise unclear to a user who never installed pi-mcp-adapter.
- **P6-DC-0606** (Low): The README hooks sentence says hooks see "the server part of a tool name as Claude Code writes it", not the whole Claude Code name, because under built-in the tool segment keeps Pi's `-` to `_` fold (D-MB-08). Alternative: "hooks see the tool under Claude Code's name", as the plan words it. Chosen so the sentence is true under both implementations.
- **P6-DC-0607** (Low): The Elicitation rows say "Pi 1.5.0 has no elicitation" in plain words instead of citing the REQUIREMENTS.md out-of-scope row, because a user doc does not cite planning files. The evidence is the empty grep recorded above. Alternative: cite `.planning/REQUIREMENTS.md`.
- **P6-DC-0608** (Low): Phase 4's built-in refusal text goes in a new paragraph with a `text` block after the adapter's tool-result block, not inline in the async paragraph as drafted, because inserting it before "With pi-mcp-adapter 7.0.0, such a launch ..." would have split that sentence from its example. It cites agent-grants.feature, whose built-in scenario asserts only that the error names `plugin_demo_stub`; the full text comes from the 04-RESEARCH measurement. Alternative: keep the draft's inline code span.
- **P6-DC-0609** (Low): The pi-mcp-adapter prerequisite now says "optional", dropping "but recommended", with the reason in a new sentence. Alternative: keep "optional but recommended". Chosen because the plan and 02-08 item 2 make it optional because built-in runs servers without it, and recommending the adapter would contradict the parity-first framing.

## Self-Check: PASSED

- FOUND: README.md, README.es.md, docs/hooks-compatibility.md, docs/mcp-compatibility.md (all modified, committed)
- FOUND: 81cc18c, aa665c7, 8969c18 (ancestors of HEAD)
- All `<automated>` verify blocks and `<acceptance_criteria>` of Tasks 1-3 re-run after the pre-commit fixers: exit 0 / expected counts.

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*
