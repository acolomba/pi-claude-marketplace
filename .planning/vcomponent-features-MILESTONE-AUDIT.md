---
milestone: component-features
audited: 2026-11-02T11:55:00Z
status: tech_debt
scores:
  requirements: 58/58
  phases: 7/7
  integration: 7/7
  flows: 5/5
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-phase
    items:
      - "W1 (WFL-*, CMD-*): no name-collision check between a plugin's workflow and its command; both become `<plugin>:<name>`, the engine's command wins, and the prompt template is reachable only through run_plugin_command, with no warning"
      - "W2 (AGT-*, MCP-*): agent MCP grants and async: true come from the resolver's server set, not from what the MCP bridge wrote; a server the MCP stage refuses (e.g. ANAME-03 folded-key collision) still gets a grant"
      - "W3 (SKL/CMD/HOOK): project installs made before the provenance ledger stop working until reinstalled; hooks skip with only a debug line; no upgrade scenario"
      - "W4 (CMD-*): run_plugin_command keeps a stale description after a second session_start in the same runtime if the new list is empty (Pi has no unregister); calls stay safe"
      - "W5 (HOOK/CMD/SKL): no scenario pins that UserPromptSubmit hooks see the raw slash text before expansion"
      - "W6 (HOOK/SKL): no scenario combines a PostToolUse hook with the model-read skill fill"
  - phase: 05-hooks
    items:
      - "T-05-33 (medium, open, no disposition): a hook's stdout cut at 1 MB under onFailure: block reads as no decision (HOOKBIGJSON-01)"
      - "T-05-34 (medium, open, no disposition): project CLAUDE_PLUGIN_DATA sits inside the repository (HOOKDATA-01)"
      - "Two follow-up prompt-context edge cases left at the review cap (P5-DC-24, HOOKFOLLOWUP-01)"
  - phase: 06-mcp-servers
    items:
      - "MCP-07 accepted deviation: a working agent MCP call waits on pi-subagents fixes (patches on acolomba/pi-subagents, branch fix/mcp-direct-tools-adapter-7) and a background-child harness (MCPBG-01)"
  - phase: milestone
    items:
      - "Pending user review: D-CF2-13, D-CF2-14, D-CF2-15, D-CF2-16, D-CF3-07 (PROJECT.md Key Decisions)"
      - "Upstream PRs to open after review: acolomba/pi fix/input-transform-expand-opt-out; acolomba/pi-subagents fix/mcp-direct-tools-adapter-7 (full suites not run in the sandbox)"
      - "Live adapter canary re-run on pi-mcp-adapter 7.0.0 (MCPCANARY-01)"
nyquist:
  compliant_phases: [01, 02, 03, 04, 05, 06, 07]
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: compliant
---

# Milestone component-features: Audit

**Status: tech_debt.** All 58 requirements are satisfied, all 7 phases pass
verification, cross-phase wiring is complete, and no end-to-end flow is broken.
The items under `tech_debt` are warnings and recorded follow-ups, not blockers.

## Phases

| Phase | Verification | Validation | Security |
| --- | --- | --- | --- |
| 1. Harness and Version Raise | passed 5/5 | compliant | 0 open |
| 2. Skills | passed 5/5 (criterion 5 by user override) | compliant | 0 open |
| 3. Slash Commands | passed 5/5 | compliant | 0 open |
| 4. Agents | passed 5/5 | compliant | 0 open |
| 5. Hooks | passed 5/5 | compliant | 0 blocking; T-05-33, T-05-34 medium, open |
| 6. MCP Servers | passed 5/5 (SC4 by user override) | compliant | 0 open |
| 7. Workflows | passed 5/5 | compliant | 0 open |

Phase 2's `02-VALIDATION.md` frontmatter said `nyquist_compliant: false`
while its body recorded approval (6/6 covered, 0 gaps); the flag was corrected
in this audit.

## Requirements (3-source cross-reference)

| Group | Phase | Verification | Traceability | Status |
| --- | --- | --- | --- | --- |
| HAR-01..08, VER-01..06, DEC-01..02, CI-01 | 1 | passed | Complete, checked | satisfied |
| SKL-01..06 | 2 | passed | Complete, checked | satisfied |
| CMD-01..05 | 3 | passed | Complete, checked | satisfied |
| AGT-01..07, XK-01 | 4 | passed | Complete, checked | satisfied |
| HOOK-01..09 | 5 | passed | Complete, checked | satisfied |
| MCP-01..08 | 6 | passed (MCP-07 by override) | Complete, checked | satisfied (MCP-07 accepted deviation) |
| WFL-01..05 | 7 | passed | Complete, checked | satisfied |

No orphaned requirements.

## Integration

The integration checker (2026-11-02, head 8cfb2b2) traced the seams no phase
owned: the input and `tool_result` handler order in `index.ts`, every reader
and writer of the project-install ledger (keys, `create`/`refresh` admission,
fail-closed reads), agents with MCP and skill preloads, hooks with the MCP
proxy, workflows with commands, and the shared cucumber harness. A cucumber dry
run over all 1554 scenarios reported 0 undefined and 0 ambiguous steps. All
seams are wired. Warnings W1-W6 are listed in the frontmatter.

## E2E flows

All traced and covered by scenarios: typed alias to a filled command; the
model running a command through `run_plugin_command`; a project install that
records the ledger and routes hooks; an unnamed update that stays refused
(D-CF2-16); an MCP tool call through the adapter with nested hooks.

## Gate

Full `npm run check` at 2ba505a: exit 0, cucumber 1554/1554 (seed 82800),
direct coverage 330 records. Later commits changed only docs and planning
files.
