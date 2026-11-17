---
milestone: parity-gaps
audited: 2026-11-17T04:30:00Z
status: tech_debt
scores:
  requirements: 42/42
  phases: 10/11
  integration: 9/9
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
stale_verifications: []
pending_human:
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
      - "HOOKRESULT-01 (full execution wrappers for Claude-shaped hook results) carried in BACKLOG."
  - phase: 03-background-subagents
    items:
      - "Advisory: since D-PG6-01 the real-child tests cannot see a hook run of a child's lifecycle event (test/integration/pi-subagents-child-identity.test.ts:119-121, features/step_definitions/plugin/subagent-hooks.steps.ts:612-645); test evidence narrowed, behavior holds."
  - phase: 04-skill-and-workflow-install-defects
    items:
      - "4 overrides, accepted by the maintainer review 2026-11-16, including SIBLINGPREFIX-01 (sibling-prefix link rewrite edge)."
  - phase: 05-stop-continuation-and-hook-failures
    items:
      - "3 override entries (4 truths): plain async reload bound Linux-only (D-PG5-18), 14 pi.on sites (D-PG6-18), json/print Stop continuation (D-PG5-01/02, residual STOPMODECHECK-01); all accepted 2026-11-16."
  - phase: 06-hook-inputs-and-events
    items:
      - "4 overrides: two judgment-tier prohibitions, D-PG6-07 legacy-record clause, and the 06-10 notice clause superseded by D-PG6-20 (Original prompt restored). The last acceptance was written by the verifier from the locked decision row."
  - phase: 07-agent-frontmatter-and-grants
    items:
      - "4 overrides accepted 2026-11-16: `subagent get` nested-subagent line (Pi capability gap), model \"\" (D-PG7-17, two clauses), block description (D-PG7-18). The D-PG7-16 README override is gone."
      - "Stale wording: 07-SECURITY.md:77 and :107 still call D-PG7-02/D-PG7-04 pending maintainer review (records only)."
  - phase: 08-workflow-agents-and-run-paths
    items:
      - "4 overrides: WR-02 note wording, D-PG8-11 option A, catalog pins (D-PG10-06 confirmed, D-PG10-25 reversed to fail closed), and the 08-03 two-scripts truth superseded by D-PG8-07/D-PG8-18."
      - "Stale wording: 08-SECURITY.md:75 and :84 still call option A of PG-WF-05 and T-08-13 pending maintainer review (records only)."
  - phase: 09-adapter-entries-and-mcp-features
    items:
      - "5 overrides (10 truths): D-PG9-07 (locked; the openUi default returns through BACKLOG MCPOPENUI-01), D-PG9-14 (two), the D-PG9-03 addition (no PROJECT.md row), all accepted 2026-11-16, plus a new one for the 09-06 truth that expected `Pending maintainer review`, based on the locked rows D-PG9-01/-07/-08 (PROJECT.md:2427-2429), no maintainer sign-off claimed. MCPSAMPLING-01 carried. 7 judgment-tier prohibitions flagged."
      - "Stale wording: 09-SECURITY.md:61, :66 and :84 still say pending maintainer review (records only)."
  - phase: 10-plugin-options-variables-and-trust
    items:
      - "3 overrides: 10-08 truth 5 changed by D-PG10-25 (fail closed, accepted 2026-11-16), and two new ones for 10-20 truths 1 and 3, which expected `Pending maintainer review`, based on the locked rows D-PG10-01 and D-PG10-04..24 (PROJECT.md:2433-2440), no maintainer sign-off claimed. PG-SEC-02 verifies directly."
      - "Advisory: the 10-02 artifact probe `PI_CLAUDE_MARKETPLACE_OPTION_` never matched (probe only)."
  - phase: 11-skills-commands-and-records
    items:
      - "The D-PG11-03 mask override was removed: the maintainer reversed the decision and the mask is gone. 7 plan truths superseded in part."
      - "Records only: 11-SECURITY.md T-11-10, T-11-11 and the :94 note cite invocation.feature:377/:402 (now :372/:397); T-11-06 still says mitigate for the example-code half that AR-11-02 now covers."
  - phase: cross-phase
    items:
      - "INFO (PG-CORE-03, PG-MCP-09): under Pi's built-in MCP an unreadable record shows only as unset options per server; the load's (failed) {unreadable} line names the plugin."
      - "INFO (PG-CORE-05): between an update that repairs userConfig and the next /reload the adapter entry is enabled again, by design."
      - "INFO (PG-CORE-01, PG-AGENT-01, PG-AGENT-05, PG-MCP-01, PG-MCP-06): existing installs change at update or reinstall; per-requirement user wording not audited."
  - phase: milestone
    items:
      - "Every D-PG Key Decisions row is locked (maintainer review 2026-11-16); T-08-13 is accepted. No decision waits for the maintainer."
      - "SUMMARY frontmatter lacks requirement IDs for several plans; every requirement is covered by a VERIFICATION.md table with evidence."
      - "SEED-261107-kax dormant pending upstream open-gsd/gsd-core#4649."
      - "Version bump, CHANGELOG PR number and the pull request wait for the user."
nyquist:
  compliant_phases: [02, 03, 04, 05, 06, 07, 08, 09, 10, 11]
  partial_phases: [01]
  not_validated_phases: []
  missing_phases: []
  overall: partial
---

# Milestone parity-gaps — Audit

**Milestone:** parity-gaps — Claude Code Parity Gaps and Defects (branch `features/gaps`, audited at `c05f9d13`, 11 phases)
**Status:** tech_debt. All 42 requirements are satisfied, every phase report is current, and the integration check finds no blocker. Only Phase 5 A9 (Node 24, PR CI) and runtime UAT stand before complete-milestone.

**Gate evidence:** `npm run check` exit 0 at `421863f6` on Node 26.13.1 with hermetic `HOME` and `PI_CODING_AGENT_DIR` (`/tmp/pg-final2.log`): adapter 2100/2100 scenarios, builtin 204/204, 376 direct-coverage records. After `421863f6` only `docs/mcp-compatibility.md:435` (ebcce31e) and `.planning/` changed, none of them build inputs.

## Changes since the previous audit (7419fab2)

421863f6 and ebcce31e removed the "pending maintainer review" wording for locked decisions from `docs/env-vars.md`, `docs/hooks-compatibility.md`, `docs/mcp-compatibility.md` (D-PG9-01/-07/-08/-14/-15/-16, D-PG7-17, the workflow-tools residual now pointing at AGTWORKFLOWAMBIENT-01), the PRD decision-14 sentence (D-PG8-07), the ROADMAP Phase 10 closeout, 10-SECURITY.md, 11-SECURITY.md (T-11-06 now cites `withoutContextInjections()`) and 11-CONTEXT.md (the D-PG11-03 reversal noted). These docs are covered by every phase report, so all 11 phases were re-verified, one at a time; phases 1 and 3 twice, after ebcce31e. No source, test or feature file changed since `5ead1acf`.

## Requirements (3-source cross-reference)

| Requirement | Phase | VERIFICATION | REQUIREMENTS.md | Final |
|---|---|---|---|---|
| PG-AGENT-02, PG-AGENT-07b, PG-MCP-01, PG-MCP-02 | 1 | passed | `[x]` | satisfied |
| PG-HOOK-01, PG-HOOK-03, PG-HOOK-13 | 2 | passed | `[x]` | satisfied |
| PG-HOOK-07a, PG-AGENT-01 | 3 | passed | `[x]` | satisfied |
| PG-CORE-01, PG-SEC-01, PG-WF-01, PG-SKILL-04 | 4 | passed | `[x]` | satisfied |
| PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, PG-HOOK-21 | 5 | human_needed (A9 only); each row SATISFIED | `[x]` | satisfied |
| PG-HOOK-11, PG-HOOK-04, PG-HOOK-06 | 6 | passed | `[x]` | satisfied |
| PG-AGENT-03, PG-AGENT-07a, PG-AGENT-05, PG-AGENT-09 | 7 | passed | `[x]` | satisfied |
| PG-WF-02, PG-WF-05, PG-WF-04, PG-WF-07 | 8 | passed | `[x]` | satisfied |
| PG-MCP-06, PG-MCP-08, PG-MCP-09, PG-SEC-03 | 9 | passed | `[x]` | satisfied |
| PG-CORE-05, PG-CORE-03, PG-CORE-06, PG-CORE-07, PG-SEC-02 | 10 | passed | `[x]` | satisfied |
| PG-CMD-09, PG-SKILL-11, PG-SKILL-01, PG-DOC-01, PG-DOC-02 | 11 | passed | `[x]` | satisfied |

42/42 checked in REQUIREMENTS.md. No requirement is orphaned or unsatisfied, so the FAIL gate does not apply.

## Phases

| Phase | VERIFICATION | Score | Current |
|---|---|---|---|
| 1 Companion Floors and MCP Defaults | passed | 20/20 (2 override) | current |
| 2 Hook Payloads, Matchers, Stop Limit | passed | 55/55 (1 override) | current |
| 3 Background Subagents | passed | 31/31 | current |
| 4 Skill and Workflow Install Defects | passed | 38/38 (4 override) | current |
| 5 Stop Continuation and Hook Failures | human_needed | 55/56 (4 override, A9) | current |
| 6 Hook Inputs and Events | passed | 104/104 (2 override) | current |
| 7 Agent Frontmatter and Grants | passed | 40/40 (4 override) | current |
| 8 Workflow Agents and Run Paths | passed | 48/48 (4 override) | current |
| 9 Adapter Entries and MCP Features | passed | 38/38 (10 override, 1 new) | current |
| 10 Plugin Options, Variables, Trust | passed | 157/157 (3 override, 2 new) | current |
| 11 Skills, Commands, and Records | passed | 6/6 | current |

The phase score 10/11 counts the reports that are passed and current; Phase 5 waits for A9. The three new overrides (09-06 truth 1, 10-20 truths 1 and 3) cover plan truths that expected decision rows to read `Pending maintainer review`; each cites the locked PROJECT.md rows as its basis and claims no maintainer sign-off. All 11 SECURITY.md files report 0 open threats.

## Integration (gsd-integration-checker, static, at 5ead1acf)

Verdict: no blocker, no warning. 9/9 seams connected and 6/6 flows complete. No file under `extensions/`, `features/`, `test/` or `scripts/` changed since `5ead1acf`, so the verdict holds at `c05f9d13`. The INFO items are under `tech_debt` → `cross-phase`.

## Open before complete-milestone

1. Phase 5 A9: the PR's CI `behavioral` job on Node 24, features/hook/failures.feature:157.
2. Runtime UAT per the milestone-close practice.
3. `audit-open`: Phase 05 human_needed (A9) and SEED-261107-kax (dormant) need an acknowledgement at close.

## Deliberately carried

AGTLONGNAME-01 and PG1-TIMING-01 stay open. SEED-261107-kax is dormant pending upstream open-gsd/gsd-core#4649. The leftover "pending" wording in 07-, 08- and 09-SECURITY.md is records only and outside the requested fix list.
