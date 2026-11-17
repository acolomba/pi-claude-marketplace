---
milestone: parity-gaps
audited: 2026-11-16T18:30:00Z
status: tech_debt
scores:
  requirements: 42/42
  phases: 6/11
  integration: 9/9
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
stale_verifications:
  - phase: "01-companion-floors-and-mcp-defaults"
    reason: "covered files changed after the report (CHANGELOG, READMEs, docs/hooks-compatibility.md, the debug record and 10 more)"
  - phase: "02-hook-payloads-matchers-and-stop-limit"
    reason: "covered source changed: bridges/hooks/dispatch.ts, exec-result.ts, wire-protocol.ts (8c64be00, 4d6825ba) and docs"
  - phase: "03-background-subagents"
    reason: "covered files changed after the report"
  - phase: "04-skill-and-workflow-install-defects"
    reason: "covered files changed after the report (workflow naming b35b86d1, 3488bf29 and docs)"
  - phase: "09-adapter-entries-and-mcp-features"
    reason: "covered files changed after the report (D-PG10-25 adapter hold-back, docs); D-PG9-07 now locked"
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
      - "Advisory: docs/research/parity-gaps/hooks.md:22 still says Stop uses agent_settled (stale since D-PG5-01)."
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
  - phase: 08-workflow-agents-and-run-paths
    items:
      - "4 overrides: WR-02 note wording, D-PG8-11 option A, catalog pins (D-PG10-06, D-PG10-25), and the 08-03 two-scripts truth superseded by D-PG8-07/D-PG8-18."
      - "Info: docs/prd/parity-gaps-prd.md:688 still says two scripts with one name fail the install; docs/mcp-compatibility.md:833 calls the D-PG8-14 residual an open maintainer question (AGTWORKFLOWAMBIENT-01)."
  - phase: 09-adapter-entries-and-mcp-features
    items:
      - "4 overrides on D-PG9-07 (amended), D-PG9-14 and the D-PG9-03 addition (no PROJECT.md row), accepted 2026-11-16. MCPOPENUI-01 and MCPSAMPLING-01 carried. 7 judgment-tier prohibitions flagged."
  - phase: 10-plugin-options-variables-and-trust
    items:
      - "1 override: 10-08 truth 5 changed by D-PG10-25 (fail closed). PG-SEC-02 now verifies directly."
      - "Advisory: the 10-02 artifact probe `PI_CLAUDE_MARKETPLACE_OPTION_` never matched (probe only)."
      - "Stale wording outside the reports: docs/env-vars.md:250 and docs/hooks-compatibility.md:376 (D-PG10-19 'pending maintainer review'), docs/mcp-compatibility.md:770 (D-PG9-07 'pending'), ROADMAP.md:497 closeout (PG-SEC-02 Pending), 10-SECURITY.md:44, :62, :100, :126."
  - phase: 11-skills-commands-and-records
    items:
      - "The D-PG11-03 mask override was removed: the maintainer reversed the decision and the mask is gone. 7 plan truths superseded in part."
      - "Stale wording: 11-CONTEXT.md still calls D-PG11-01/02/06 pending; 11-SECURITY.md:41 names the removed fence and span masks as the T-11-06 mitigation."
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

**Milestone:** parity-gaps — Claude Code Parity Gaps and Defects (branch `features/gaps`, audited at `5ead1acf`, 11 phases)
**Status:** tech_debt. All 42 requirements are satisfied, and the integration check finds no blocker. Two things stand before complete-milestone: five phase reports (1, 2, 3, 4, 9) are stale because later commits changed files they cover, and Phase 5 waits for A9 on Node 24 in PR CI.

**Gate evidence:** `npm run check` exit 0 at `333784b7` on Node 26.13.1 with a hermetic `PI_CODING_AGENT_DIR` (`/tmp/pg-final.log`): adapter 2100/2100 scenarios, builtin 204/204, 376 direct-coverage records. Only `.planning/` changed after `333784b7`.

## Changes since the previous audit (e01c2598)

The maintainer review of 2026-11-16 locked every pending D-PG row, reversed D-PG11-03, and accepted T-08-13. Code commits from it: c6812df5 (mentions inside code are attached), 4d6825ba and 8c64be00 (block notices end with `Original prompt:`), b35b86d1 and 3488bf29 (workflow names: keep the last script; keep both names the elision would merge, D-PG8-18), 6d9a3cdd and 78011db4 (an unreadable recorded `userConfig` fails closed, D-PG10-25). PG-SEC-02 is complete (D-PG10-01 option A confirmed). Phases 5, 6, 7, 8, 10 and 11 were re-verified against the gate above.

## Requirements (3-source cross-reference)

| Requirement | Phase | VERIFICATION | REQUIREMENTS.md | Final |
|---|---|---|---|---|
| PG-AGENT-02, PG-AGENT-07b, PG-MCP-01, PG-MCP-02 | 1 | passed (stale report) | `[x]` | satisfied |
| PG-HOOK-01, PG-HOOK-03, PG-HOOK-13 | 2 | passed (stale report) | `[x]` | satisfied |
| PG-HOOK-07a, PG-AGENT-01 | 3 | passed (stale report) | `[x]` | satisfied |
| PG-CORE-01, PG-SEC-01, PG-WF-01, PG-SKILL-04 | 4 | passed (stale report) | `[x]` | satisfied |
| PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, PG-HOOK-21 | 5 | human_needed (A9 only); each row SATISFIED | `[x]` | satisfied |
| PG-HOOK-11, PG-HOOK-04, PG-HOOK-06 | 6 | passed | `[x]` | satisfied |
| PG-AGENT-03, PG-AGENT-07a, PG-AGENT-05, PG-AGENT-09 | 7 | passed | `[x]` | satisfied |
| PG-WF-02, PG-WF-05, PG-WF-04, PG-WF-07 | 8 | passed | `[x]` | satisfied |
| PG-MCP-06, PG-MCP-08, PG-MCP-09, PG-SEC-03 | 9 | passed (stale report) | `[x]` | satisfied |
| PG-CORE-05, PG-CORE-03, PG-CORE-06, PG-CORE-07, PG-SEC-02 | 10 | passed | `[x]` | satisfied |
| PG-CMD-09, PG-SKILL-11, PG-SKILL-01, PG-DOC-01, PG-DOC-02 | 11 | passed | `[x]` | satisfied |

No requirement is orphaned or unsatisfied, so the FAIL gate does not apply.

## Phases

| Phase | VERIFICATION | Score | Current |
|---|---|---|---|
| 1 Companion Floors and MCP Defaults | passed | 20/20 (2 override) | **stale** |
| 2 Hook Payloads, Matchers, Stop Limit | passed | 55/55 | **stale** |
| 3 Background Subagents | passed | 31/31 | **stale** |
| 4 Skill and Workflow Install Defects | passed | 38/38 (4 override) | **stale** |
| 5 Stop Continuation and Hook Failures | human_needed | 55/56 (4 override, A9) | current |
| 6 Hook Inputs and Events | passed | 104/104 (2 override) | current |
| 7 Agent Frontmatter and Grants | passed | 40/40 (4 override) | current |
| 8 Workflow Agents and Run Paths | passed | 48/48 (4 override) | current |
| 9 Adapter Entries and MCP Features | passed | 38/38 (9 override) | **stale** |
| 10 Plugin Options, Variables, Trust | passed | 157/157 (1 override) | current |
| 11 Skills, Commands, and Records | passed | 6/6 | current |

The phase score 6/11 counts the reports that are both passed and current. All 11 SECURITY.md files report 0 open threats.

## Integration (gsd-integration-checker, static, at 5ead1acf)

Verdict: no blocker, no warning. 9/9 seams connected and 6/6 flows complete. The D-PG10-25 fail-closed path is consistent across the shared reader (`persistence/state-io.ts:371-385`), both hook lanes (`spawn-helpers.ts:108-109` through `planSpawn`), list, info, the load and user-scope startup hold-back, built-in MCP, and the update and reinstall repair. The `Original prompt:` notice and its onFailure suppression, the workflow naming changes (one discovery for install, update and info), and the reversed mention mask are wired. The INFO items are under `tech_debt` → `cross-phase`.

## Open before complete-milestone

1. Re-verify Phases 1, 2, 3, 4 and 9 (stale reports).
2. Phase 5 A9: the PR's CI `behavioral` job on Node 24, features/hook/failures.feature:157.
3. Runtime UAT per the milestone-close practice.

## Deliberately carried

AGTLONGNAME-01 and PG1-TIMING-01 stay open. SEED-261107-kax is dormant pending upstream open-gsd/gsd-core#4649.
