---
milestone: parity-gaps
audited: 2026-11-16T09:00:00Z
status: tech_debt
scores:
  requirements: 41/42
  phases: 10/11
  integration: 9/9
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
pending_human:
  - id: "PG-SEC-02"
    status: "partial (maintainer decision pending)"
    phase: "10-plugin-options-variables-and-trust"
    claimed_by_plans: ["10-20"]
    completed_by_plans: []
    verification_status: "passed (by override: maintainer decision, not code)"
    evidence: "D-PG10-01 is recorded with its premise and Pi 1.5.0/1.5.2 (PROJECT.md:2432); option A was taken by the autonomous run and the row says Pending maintainer review. REQUIREMENTS.md keeps PG-SEC-02 `[ ]` / Pending until the maintainer confirms or reopens the D-LOC-01 trust gap."
  - id: "05-HV-1"
    phase: "05-stop-continuation-and-hook-failures"
    item: "Confirm the saved hook output disclosure rule (05-06 judgment-tier prohibition): docs/hooks-compatibility.md:472-476 and CHANGELOG.md:23 tell the user that over-limit hook output is saved, where, the project-scope version-control note, and the 30-day removal."
  - id: "05-HV-2 (A9)"
    phase: "05-stop-continuation-and-hook-failures"
    item: "The start-failure notice (features/hook/failures.feature:157, `spawn missing-guard.sh ENOENT`) has never run on Node 24; it ran on Node 22.22.2 and 26.13.1 only. Closes with the PR's CI `behavioral` job."
tech_debt:
  - phase: 01-companion-floors-and-mcp-defaults
    items:
      - "Nyquist PARTIAL: PG1-TIMING-01, focused-feedback timing sign-off incomplete, nyquist_compliant false (01-VALIDATION.md); deliberately carried."
      - "AGTLONGNAME-01 open external limitation: pi-subagents names a granted adapter tool over 64 characters without the cut (BACKLOG.md:5212); deliberately carried."
      - "2 overrides (suite version superseded by D-PG1-02; real-child exclusion deferral, proven on 0.88.1); 17 judgment-tier prohibitions flagged for human review."
  - phase: 02-hook-payloads-matchers-and-stop-limit
    items:
      - "Advisory: docs/research/parity-gaps/hooks.md:22 still says Stop uses agent_settled (stale since D-PG5-01)."
      - "HOOKRESULT-01 (full execution wrappers for Claude-shaped hook results) carried in BACKLOG."
  - phase: 03-background-subagents
    items:
      - "Advisory: since D-PG6-01 the real-child tests cannot see a hook run of a child's lifecycle event (test/integration/pi-subagents-child-identity.test.ts:119-121, features/step_definitions/plugin/subagent-hooks.steps.ts:612-645); test evidence narrowed, behavior holds."
  - phase: 04-skill-and-workflow-install-defects
    items:
      - "4 overrides pending maintainer review, including SIBLINGPREFIX-01 (sibling-prefix link rewrite edge, BACKLOG.md:5357)."
  - phase: 05-stop-continuation-and-hook-failures
    items:
      - "4 overrides: plain async reload bound Linux-only (D-PG5-18), pi.on count 14 (D-PG6-18), json/print Stop continuation carried by D-PG5-01/02 with residual STOPMODECHECK-01 (BACKLOG.md:5373)."
  - phase: 06-hook-inputs-and-events
    items:
      - "3 overrides pending maintainer review (two judgment-tier prohibitions; D-PG6-07 legacy-record clause)."
  - phase: 07-agent-frontmatter-and-grants
    items:
      - "5 overrides pending maintainer review: `subagent get` cannot show nested-subagent capability (Pi capability gap); inherit written as model \"\" (D-PG7-17); one-line description block form (D-PG7-18); README clause (D-PG7-16)."
  - phase: 08-workflow-agents-and-run-paths
    items:
      - "3 overrides: missing-agent note wording (review fix WR-02), PG-WF-05 option A chosen by the autonomous run (D-PG8-11), catalog pin counts superseded by D-PG10-06."
  - phase: 09-adapter-entries-and-mcp-features
    items:
      - "4 overrides on recorded decisions pending maintainer review (D-PG9-07 amended: openUi default withheld; D-PG9-14 caFile exact trust and choice store; D-PG9-03 addition). PG-SEC-03 is satisfied through recorded divergences D-PG9-07/D-PG9-08. MCPSAMPLING-01 carried. 7 judgment-tier prohibitions flagged."
  - phase: 10-plugin-options-variables-and-trust
    items:
      - "Advisory: D-PG10-16, -23 and -24 Key Decisions rows name no checked-against version (10-20 truth 3, records only)."
      - "Advisory: 10-02 artifact probe `contains: PI_CLAUDE_MARKETPLACE_OPTION_` fails on test/integration/adapter-expansion-conformance.test.ts (probe only; truth holds)."
      - "Override D-PG10-25 (unreadable stored userConfig fails closed); D-PG10-04/-06/-11/-16/-19 pending maintainer review; 19 judgment-tier prohibitions flagged."
  - phase: 11-skills-commands-and-records
    items:
      - "Override: two remaining CommonMark gaps of the D-PG11-03 code mask (HTML block read as a paragraph, incl. its fence effect), pending maintainer review."
      - "Advisory: 11-CONTEXT.md D-PG11-03 still describes the iteration-3 residuals that 1183aae3 closed; the HTML-block gap is stated narrower than it is in domain/file-mentions.ts:27-29 and docs/skills-commands-compatibility.md:74."
      - "Maintainer review: D-PG11-01 (a 'no' descopes PG-CMD-09), D-PG11-02, D-PG11-03, D-PG11-06 (no PROJECT.md row); 14 judgment-tier prohibitions flagged."
  - phase: cross-phase
    items:
      - "INFO (PG-CMD-09): a command staged before D-PG11-01 has no stored Claude name and gains the `/<plugin>:<path>:<file>` alias only after update, reinstall, or enable restages it (orchestrators/skill-alias-state.ts:23-25, by design). The user docs (docs/skills-commands-compatibility.md, CHANGELOG) do not say so."
      - "INFO (PG-CORE-01, PG-AGENT-01, PG-AGENT-05, PG-MCP-01, PG-MCP-06): existing installs change at update or reinstall because update-swap.ts reuses the install path's bridge staging; the integration checker did not audit each requirement's user-facing wording of that."
      - "PG-CORE-06/07 trust gate in orchestrators/plugin-path.ts was not traced cross-phase (single-phase; covered by 10-VERIFICATION)."
  - phase: milestone
    items:
      - "43 Key Decisions rows (D-PG4-01 .. D-PG11-03) in .planning/PROJECT.md read Pending maintainer review; plus the per-phase overrides above accepted by the autonomous run."
      - "SUMMARY frontmatter lacks requirement IDs for phases 5, 7, 10 (except PG-CORE-05) and part of 2, 4, 6, 8, 11; every requirement is covered by a VERIFICATION.md table with evidence."
      - "Open artifacts: debug session real-child-mcp-automation awaiting_human_verify (evidence suggests met); SEED-261107-kax dormant pending upstream open-gsd/gsd-core#4649."
      - "Version bump, CHANGELOG PR number, and the pull request wait for the user."
nyquist:
  compliant_phases: [02, 03, 04, 05, 06, 07, 08, 09, 10, 11]
  partial_phases: [01]
  not_validated_phases: []
  missing_phases: []
  overall: partial
---

# Milestone parity-gaps — Audit

**Milestone:** parity-gaps — Claude Code Parity Gaps and Defects (branch `features/gaps`, audited at `e01c2598`, 11 phases, 102 plans)
**Status:** tech_debt — no code or integration blocker. 41 of 42 requirements are satisfied; PG-SEC-02 is a maintainer decision that is recorded but not yet answered. Phase 5 carries two human verification items. Many decisions wait for maintainer review.

**Gate evidence:** `npm run check` exit 0 at `1183aae3` (2098 adapter + 204 builtin scenarios); no source change since. All 11 phases were re-verified on 2026-11-16 against that gate. All 11 SECURITY.md files are `verified` with 0 open threats.

## Requirements (3-source cross-reference)

| Requirement | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS.md | Final |
|---|---|---|---|---|---|
| PG-AGENT-02, PG-AGENT-07b, PG-MCP-01, PG-MCP-02 | 1 | passed, SATISFIED | listed | `[x]` | satisfied |
| PG-HOOK-01, PG-HOOK-03, PG-HOOK-13 | 2 | passed, SATISFIED | listed | `[x]` | satisfied |
| PG-HOOK-07a, PG-AGENT-01 | 3 | passed, SATISFIED | listed | `[x]` | satisfied |
| PG-CORE-01, PG-SEC-01, PG-WF-01 | 4 | passed, SATISFIED | listed | `[x]` | satisfied |
| PG-SKILL-04 | 4 | passed, SATISFIED (one edge by override) | listed (requirements key) | `[x]` | satisfied |
| PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, PG-HOOK-21 | 5 | human_needed; each row SATISFIED (PG-HOOK-14: A9 Node 24 wording pending CI) | missing | `[x]` | satisfied (verified manually; human items below) |
| PG-HOOK-11 | 6 | passed, SATISFIED | listed | `[x]` | satisfied |
| PG-HOOK-04, PG-HOOK-06 | 6 | passed, SATISFIED | missing | `[x]` | satisfied (verified manually) |
| PG-AGENT-03, PG-AGENT-07a | 7 | passed, SATISFIED | listed (other key) | `[x]` | satisfied |
| PG-AGENT-05, PG-AGENT-09 | 7 | passed, SATISFIED | missing | `[x]` | satisfied (verified manually) |
| PG-WF-02, PG-WF-05 | 8 | passed, SATISFIED (WF-05 closed as not a gap, D-PG8-11) | listed (other key) | `[x]` | satisfied |
| PG-WF-04, PG-WF-07 | 8 | passed, SATISFIED | missing | `[x]` | satisfied (verified manually) |
| PG-MCP-06, PG-MCP-08, PG-MCP-09, PG-SEC-03 | 9 | passed, SATISFIED (SEC-03 via recorded divergences) | listed | `[x]` | satisfied |
| PG-CORE-05 | 10 | passed, SATISFIED | listed | `[x]` | satisfied |
| PG-CORE-03, PG-CORE-06, PG-CORE-07 | 10 | passed, SATISFIED | missing | `[x]` | satisfied (verified manually) |
| **PG-SEC-02** | 10 | passed by override; "NEEDS MAINTAINER" | missing | `[ ]` Pending | **partial: maintainer decision D-PG10-01 pending** |
| PG-CMD-09, PG-SKILL-11, PG-SKILL-01, PG-DOC-01, PG-DOC-02 | 11 | passed, SATISFIED | listed | `[x]` | satisfied |

"Verified manually" means the SUMMARY frontmatter does not name the ID, so this audit took the status from the VERIFICATION.md requirements table and its evidence. No requirement is orphaned: all 42 IDs appear in a phase VERIFICATION.md. No requirement is `unsatisfied`, so the FAIL gate does not apply.

## Phases

| Phase | Plans | VERIFICATION | Score | Nyquist |
|---|---|---|---|---|
| 1 Companion Floors and MCP Defaults | 11 | passed | 20/20 (2 override) | PARTIAL (PG1-TIMING-01) |
| 2 Hook Payloads, Matchers, Stop Limit | 10 | passed | 55/55 | compliant |
| 3 Background Subagents | 8 | passed | 31/31 | compliant |
| 4 Skill and Workflow Install Defects | 6 | passed | 38/38 (4 override) | compliant |
| 5 Stop Continuation and Hook Failures | 6 | **human_needed** | 55/56 (4 override, 1 CI item) | compliant |
| 6 Hook Inputs and Events | 13 | passed | 104/104 (1 override) | compliant |
| 7 Agent Frontmatter and Grants | 6 | passed | 40/40 (5 override) | compliant |
| 8 Workflow Agents and Run Paths | 7 | passed | 48/48 (3 override) | compliant |
| 9 Adapter Entries and MCP Features | 6 | passed | 38/38 (9 override) | compliant |
| 10 Plugin Options, Variables, Trust | 21 | passed | 156/157 (2 override, 1 advisory) | compliant |
| 11 Skills, Commands, and Records | 8 | passed | 7/7 (1 override) | compliant |

## Integration (gsd-integration-checker, static, at e01c2598)

Verdict: no blocker. 9/9 seams connected, 6/6 E2E flows complete.

| Seam | Requirements | Result |
|---|---|---|
| One Claude-form tool name (`claudeFormToolName`, `mcp-tool-view.ts`, `dispatch.ts`, `mcp-server-table.ts`) | PG-HOOK-01/03/04, PG-MCP-02 | wired |
| Stop cap on `agent_before_settle` (`event-router.ts:1611-1620`, `settle.ts`), 14 `pi.on` sites | PG-HOOK-02/13 | wired |
| Child suppression incl. UserPromptExpansion (`CHILD_EVENT_POLICY`, `event-router.ts:166-179, 1135`) | PG-HOOK-07a, PG-HOOK-06 | wired |
| Child root session (`createBeforeAgentStartHandler`, `event-router.ts:322-349`) | PG-HOOK-07a | wired |
| Shared plugin-names cache for typed expansion and aliases (`index.ts:182-185`, `edge/skill-aliases.ts:158`, `command-record.ts`) | PG-HOOK-06, PG-CMD-09, PG-SKILL-11 | wired |
| @path attachments in command and skill invocation (`mention-attachments.ts`) | PG-SKILL-01 | wired |
| Adapter entry defaults + carried fields + options (`adapter-entry.ts`, `builtin-entry.ts`, `builtin-escape.ts`) | PG-MCP-01/06/09, PG-CORE-03 | wired |
| Install vs update parity (`install-outcome.ts:1270-1550` vs `update-swap.ts:410-520, 976`; hooks read `recordedOptionsOf` at load) | PG-CORE-03/05, PG-AGENT-07b/03/09, PG-MCP-* | wired |
| Workflow agent notes from one source (`discover-names.ts`) on install, info, update | PG-WF-02, PG-SEC-01 | wired |

Flows: install → `/reload` → hooks with options and Claude-form names; update/reinstall restages all six component kinds; typed command → UserPromptExpansion → attachments; pi-subagents child runs no main-session hooks; MCP entry defaults/carried fields/options under both implementations; workflow `agentType` binds the bridged agent or notes a missing one.

INFO findings (non-blocking) are listed under `tech_debt` → `cross-phase`.

## Human verification and maintainer review

1. **PG-SEC-02 / D-PG10-01:** the maintainer confirms option A (keep the D-LOC-01 trust gap) or reopens it. Until then PG-SEC-02 stays `[ ]`.
2. **Phase 5, saved hook output disclosure:** read docs/hooks-compatibility.md:472-476 and CHANGELOG.md:23 and confirm the rule.
3. **Phase 5, A9:** run the PR's CI `behavioral` job on Node 24 and check features/hook/failures.feature:157.
4. **43 pending Key Decisions rows** (D-PG4-01 .. D-PG11-03) and the overrides that rest on them; the 4 Phase 11 maintainer-review items (D-PG11-01 can descope PG-CMD-09).
5. **Judgment-tier prohibitions** flagged across phases (17 + 7 + 19 + 14 and others), non-authoritative verdict "holds".
6. Debug session `real-child-mcp-automation` (awaiting_human_verify).

## Deliberately carried

AGTLONGNAME-01 and PG1-TIMING-01 stay open. SEED-261107-kax is dormant pending upstream open-gsd/gsd-core#4649. Quick task 261109-cpj is complete (b697a227).
