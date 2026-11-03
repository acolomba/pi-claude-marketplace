---
milestone: component-features
audited: 2026-11-03T06:00:00Z
re_audit: "2026-11-03 after Phase 8; prior audit 2026-11-02"
status: tech_debt
scores:
  requirements: 62/62
  phases: 8/8
  integration: 6/6
  flows: 5/5
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-phase
    items:
      - "RESOLVED 2026-11-02 (41deffd, D-CF7-05): W1 (WFL-*, CMD-*): no name-collision check between a plugin's workflow and its command; both become `<plugin>:<name>`, the engine's command wins, and the prompt template is reachable only through run_plugin_command, with no warning"
      - "NOT A DEFECT 2026-11-03 (DC-44, scenario added): W2 (AGT-*, MCP-*): agent MCP grants and async: true come from the resolver's server set, not from what the MCP bridge wrote; a server the MCP stage refuses (e.g. ANAME-03 folded-key collision) still gets a grant"
      - "SCENARIO ADDED 2026-11-02 (19ff1af): W3 (SKL/CMD/HOOK): project installs made before the provenance ledger stop working until reinstalled; hooks skip with only a debug line; no upgrade scenario"
      - "NOT A DEFECT 2026-11-03 (DC-44, scenario added): W4 (CMD-*): run_plugin_command keeps a stale description after a second session_start in the same runtime if the new list is empty (Pi has no unregister); calls stay safe"
      - "SCENARIO ADDED 2026-11-02 (92cd7b3): W5 (HOOK/CMD/SKL): no scenario pins that UserPromptSubmit hooks see the raw slash text before expansion"
      - "RESOLVED 2026-11-02 (a7fb423): SCENARIO ADDED 2026-11-02 (9789ef5): W6 (HOOK/SKL): no scenario combines a PostToolUse hook with the model-read skill fill"
  - phase: 05-hooks
    items:
      - "RESOLVED 2026-11-02 (ed29766, DC-42, Phase 8 plan 2): T-05-33 (medium): a hook's stdout cut at 1 MB under onFailure: block reads as no decision (HOOKBIGJSON-01)"
      - "ACCEPTED 2026-11-02 (D-LOC-01, DC-41, Phase 8 plan 1): T-05-34 (medium), intended under the locality principle: project CLAUDE_PLUGIN_DATA sits inside the repository (HOOKDATA-01)"
      - "Two follow-up prompt-context edge cases left at the review cap (P5-DC-24, HOOKFOLLOWUP-01)"
  - phase: 06-mcp-servers
    items:
      - "MCP-07 accepted deviation: a working agent MCP call waits on pi-subagents fixes (patches on acolomba/pi-subagents, branch fix/mcp-direct-tools-adapter-7) and a background-child harness (MCPBG-01)"
  - phase: milestone
    items:
      - "REVIEWED 2026-11-02 (DC-41): D-CF2-13..16 and D-CF3-07 reversed by the user in favor of D-LOC-01"
      - "D-CF7-05 rests on a static read of the Claude Code 2.1.316 binary; confirm with a live probe when the host token folder is not readable"
      - "Upstream PRs to open after review: acolomba/pi fix/input-transform-expand-opt-out; acolomba/pi-subagents fix/mcp-direct-tools-adapter-7 (full suites not run in the sandbox)"
      - "Live adapter canary re-run on pi-mcp-adapter 7.0.0 (MCPCANARY-01)"
nyquist:
  compliant_phases: [01, 02, 03, 04, 05, 06, 07]
  partial_phases: []
  not_validated_phases: [08]
  missing_phases: []
  overall: compliant
---

# Milestone component-features: Audit

**Status: tech_debt.** All 62 requirements are satisfied, all 8 phases pass
verification, cross-phase wiring is complete, and no end-to-end flow is broken.
Phase 8 is a retroactive record of work merged after the first close; it has
no separate validation or security file, and each of its items carries a
scenario that fails without the change (DC-42..DC-45).
The items under `tech_debt` are warnings and recorded follow-ups, not blockers.

## Phases

| Phase | Verification | Validation | Security |
| --- | --- | --- | --- |
| 1. Harness and Version Raise | passed 5/5 | compliant | 0 open |
| 2. Skills | passed 5/5 (criterion 5 by user override) | compliant | 0 open |
| 3. Slash Commands | passed 5/5 | compliant | 0 open |
| 4. Agents | passed 5/5 | compliant | 0 open |
| 5. Hooks | passed 5/5 | compliant | 0 open (T-05-33 fixed, T-05-34 accepted under D-LOC-01) |
| 6. MCP Servers | passed 5/5 (SC4 by user override) | compliant | 0 open |
| 7. Workflows | passed 5/5 | compliant | 0 open |
| 8. Locality and Upstream Alignment | passed 4/4 | not run (retroactive) | not run (retroactive; locality reviewed in DC-41) |

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
| LOC-01..04 | 8 | passed | Complete, checked | satisfied |

No orphaned requirements.

## Integration

Re-checked 2026-11-03 at ab28834 by the integration checker, after the
locality redesign removed the project-install ledger. Every seam no phase owns
is wired:

1. The `input` and `tool_result` handler order in `index.ts`: hooks first,
   then the background autoupdate, skill aliases, command invocation (after the
   alias rewrite), the skill-read fill (after PostToolUse hooks) and the command
   tool.
2. Project trust: every gate reads Pi's `ctx.isProjectTrusted()` (discovery,
   hooks, skills, commands, aliases, `run_plugin_command`, skill-read fill,
   autoapply on load and its command, background autoupdate). No code reads or
   writes a ledger.
3. Agents with MCP grants and skill preloads, on install and update.
4. Hooks with the MCP proxy: the outer call fires no hooks, the nested call
   fires them under the real tool name.
5. Workflows with commands (D-CF7-05), and project workflows in
   `.pi/workflows/saved/`.
6. The shared cucumber harness: a dry run over 1539 scenarios reports 0
   undefined and 0 ambiguous steps.

Points to watch, not defects: hook trust refreshes at session start and
resource discovery, so a mid-session trust change applies after a reload, as
in Pi; whether the workflow engine reads an untrusted project's
`.pi/workflows/saved/` is the engine's behavior, not this extension's.

## E2E flows

All traced and covered by passing scenarios (43/43 in the six feature files
run, seed 34012): a typed alias to a filled command; the model running a
command through `run_plugin_command`; a project install that routes hooks in a
trusted project and stays inert in an untrusted one; a project install from a
user-scope marketplace, which brings the marketplace into the project scope;
an MCP tool call through the adapter with nested hooks.

## Gate

Full `npm run check` at ab28834: exit 0, cucumber 1539/1539 (seed 516814),
direct coverage 327 records. The earlier gate at 2ba505a (1554 scenarios, 330
records) predates the locality redesign, which removed the ledger scenarios and
code.

## Follow-up (2026-11-02, user request)

The user chose to fix W1 and cover W3, W5 and W6 before closing. W1 is fixed
(D-CF7-05: the workflow wins and the command is skipped with a warning, as the
Claude Code binary orders them). W3, W5 and W6 now have scenarios. The W3
behavior itself (a pre-ledger install stops until reinstalled; hooks skip
silently) is unchanged and remains accepted debt. W6 pins that the model-read
fill applies by line position to text a PostToolUse hook replaced, which may
deserve a change. W2 and W4 remain open debt. Full `npm run check` after
these commits: exit 0, cucumber 1565/1565 (seed 367566), 330 coverage records.

## Follow-up (2026-11-03, user request)

W2 and W4 are not defects; neither can happen, and each now has a scenario
that guards the reason (DC-44). W2: every way a declared server can go
unwritten throws in the mcp stage (an unreadable `mcp-adapter.json` refuses
whenever the plugin has servers, AFILE-02, and both name collisions throw),
and the ledger then removes the plugin's agents, so a finished install has
written every server its agents are granted. W4: Pi builds a new extension
runtime, and with it a new tool registry, for every `session_start` (new,
resume, fork, reload), so no tool from an earlier session survives into the
next.

## Re-audit (2026-11-03)

After the first close the milestone was reopened for the user's decisions
(DC-41..DC-45), recorded as Phase 8. Phases 2, 3, 5 and 7 were re-verified
against the changed code and still pass; Phase 3 carries three overrides for
the ledger plans that D-LOC-01 reversed. Phase 8 passes 4/4. A typed-skill
path-variable scenario replaced the one removed with the ledger.
