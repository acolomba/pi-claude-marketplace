---
milestone: mcp-builtin
audited: 2026-11-05T04:30:00Z
status: tech_debt
scores:
  requirements: 31/31
  phases: 6/6
  integration: 9/9
  flows: 8/8
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 02-built-in-materialization
    items:
      - "Nyquist PARTIAL: 02-VALIDATION.md withholds nyquist_compliant for BLT-01 (`/reload`, new session), MSEL-02 (`/reload`) and BLT-04 ('never silent'); the two manual checks in 02-UAT.md wait for the user (P2-DC-100, High). 06-05 lifted the new-session scenario to `@mcp`, so BLT-01's new-session half now has an automated scenario under both profiles."
      - "02-VERIFICATION.md scores 5/7 must-haves verified. The combined-tree re-verification (c7a0358) reads `human_needed`: the `/reload` leg of BLT-01 and BLT-04 'never silent' wait for the two manual checks in 02-UAT.md. The earlier `passed` was an orchestrator disposition (P2-DC-100), which the re-verification did not keep."
  - phase: 06-release-docs-and-combined-tree
    items:
      - "Review info items IN-01, IN-02, IN-04 to IN-09 deferred (06-REVIEW-DISPOSITION.md): the cucumber completion step injects the profile's implementation (IN-01); D-P6-18, D-P6-22, P2-DC-53 and P2-DC-77 are cited in code but have no Key Decisions row (IN-02); the CHANGELOG names only `install` and `update --partial` completion (IN-04); schema literals repeated (IN-05); a grant test that cannot tell the run from the argument (IN-06); an optional cache stamp kept for fixtures (IN-07); a disabled branch no longer reached with stale comments (IN-08); edge-deps test cases that break cases.md (IN-09)."
      - "Pi 1.5.0 RPC `new_session` runs `session_start` twice and the built-in MCP keeps the first server process until Pi exits; the harness tolerates it with a 10 s wait, the leak is unreported upstream (P6-DC-0503)."
      - "UF-1 is asymmetric: `recordedMcpServers` still returns the stored `mcpServerConfigs` of an uncontained record without a containment check (P6-SEC-02)."
      - "The completion cache stamps one shared file instead of keying by implementation (D-P6-22 amended): two Pi processes on one scope under different implementations rebuild it in turn (P6-SEC-03)."
  - phase: cross-phase
    items:
      - "W1 (MREC-02, BLT-05): `orchestrators/plugin/info-mcp-status.ts:149-151` reads `record.mcpServerConfigs` directly with a `resources.mcpServers` fallback instead of going through `recordedMcpServers` and the legacy reader; for a pre-milestone record, `info` under built-in could omit a server the registration step registers. No profile diverges that way today, so it shows no wrong result yet."
      - "The built-in registration runs at `session_start` and again after the load reconcile; idempotent by design, but no test pins that two registrations leave Pi's registry unchanged."
      - "MGRT-02's background-child check reads pi-subagents 0.84.0's `PI_SUBAGENT_CHILD` variable (a soft dependency); a rename upstream would fail silently."
  - phase: milestone
    items:
      - "Decisions waiting on the user: 12 High entries and 36 Pending Key Decisions rows, listed at the top of `.planning/DUBIOUS-CHOICES.md`."
      - "Version bump, CHANGELOG PR number, and the pull request wait for the user (D-P6-17)."
      - "CI re-run 41967152313 on 2b6f2f4 (after the review fixes) passed on attempt 2: attempt 1 failed one adapter-components scenario, BLT-01 at `lifecycle.feature:392`, the known adapter flake P3-DC-111 (pi-mcp-adapter had not listed the tool yet). The scenario is the one 06-05 lifted to `@mcp`; its stand-in wait does not cover the adapter's listing, so the flake stays open."
nyquist:
  compliant_phases: [01, 03, 04, 05, 06]
  partial_phases: [02]
  not_validated_phases: []
  missing_phases: []
  overall: partial
---

# Milestone mcp-builtin — Audit

**Milestone:** mcp-builtin — MCP Built-in (branch `features/mcp-builtin`, audited at `99459fd`)
**Status:** tech_debt — every requirement is satisfied and no blocker exists; deferred items need the user's review.

## Requirements (3-source cross-reference)

All 31 requirements mapped to this milestone are satisfied: each one is `[x]` and `Complete` in
REQUIREMENTS.md, listed in at least one SUMMARY's `requirements-completed`, and covered by a
`passed` VERIFICATION.md. No requirement is orphaned.

| Requirement | Phase | Summaries | Verifications | Status |
|-------------|-------|-----------|---------------|--------|
| PI15-01..03 | 1 | 01-01, 01-14 | 01 | satisfied |
| MSEL-01 | 1 | 01-03/05/06/11/14, 06-09 | 01, 05, 06 | satisfied |
| MSEL-02, MSEL-03, MSEL-04 | 2 | 02-01, 02-07 | 02, 06 | satisfied (MSEL-02 `/reload` half manual, see tech debt) |
| MREC-01 | 1 | 01-03/08/12/14 | 01 | satisfied |
| MREC-02 | 2 | 02-01, 02-07, 06-08 | 02, 06 | satisfied |
| MREC-03..07 | 3 | 03-01..08, 06-03 | 02, 03, 06 | satisfied |
| BLT-01..06 | 2 | 02-01..09, 06-04, 06-05 | 02, 06 | satisfied (BLT-01 and BLT-04 have manual halves, see tech debt) |
| MGRT-01, MGRT-02 | 4 | 04-01..06, 06-02 | 04, 06 | satisfied |
| MHK-01, MHK-02 | 5 | 05-01..04 | 05 | satisfied |
| DUAL-01..03 | 1 | 01-02/07/09/10/13/14, 06-12 | 01, 06 | satisfied |
| DUAL-04 | 6 | 06-01, 06-12, 06-13 | 06 | satisfied |
| MDOC-01 | 2 | 02-08 | 02 | satisfied |
| MDOC-02 | 6 | 06-06/07/10/12/13 | 06 | satisfied |
| MDEC-01 | 1 | 01-02/04/14 | 01 | satisfied |

## Phases

| Phase | Verification | Score | Validation | Security |
|-------|--------------|-------|------------|----------|
| 01 Foundation and Pi 1.5.0 | passed | 5/5 | validated, compliant | 0 open |
| 02 Built-in Materialization | human_needed | 5/7 | validated, partial | 0 open |
| 03 Read-Time Verdicts | passed | 5/5 | validated, compliant | 0 open |
| 04 Agent Grants | passed | 3/3 | validated, compliant | 0 open |
| 05 Hook Tool Names | passed | 6/6 | validated, compliant | 0 open |
| 06 Release Docs and Combined Tree | passed | 4/4 | validated, compliant | 0 open |

## Integration (gsd-integration-checker, HEAD 99459fd)

9/9 seams wired: the active-implementation snapshot, the implementation profiles, recorded
servers and the legacy reader, the built-in registration step and resync, the agent-grants step,
read-time verdicts and markers, agent grant rendering, hook tool names, and the dual-profile
harness. 8/8 end-to-end flows complete (install under each implementation, session start, the
legacy reader, list/info verdicts, agent grants, hook tool names, the DUAL-04 switch — run and
passed — and update/apply/completion). One warning, W1, is listed under tech debt.

## Combined-tree evidence

- `npm run check` (static parts, unpaired, integration, adapter 1603/1603 and builtin 133/133
  scenarios, direct coverage) passed on 71a37c4 after the review fixes; `test:modules` passed on
  2b6f2f4; both trees have the same build inputs as the audited HEAD apart from `.planning/`.
- Plan 06-12's gate (fresh ESLint cache, `test:modules`, e2e) passed on a7f73bf, and CI run
  41960058038 passed on 1bec91e (every behavioral leg under 5 minutes, `timeout-minutes: 15`
  stays). The CI re-run 41967152313 on 2b6f2f4 passed after one rerun of the flaky
  adapter-components job (P3-DC-111); its legs ran 3 min 36 s, 4 min 30 s and 2 min 23 s.

## Tech debt

See the frontmatter `tech_debt` list. None of it blocks the milestone: the items are deferred
review notes, manual checks only the user can run, and follow-ups for after the user's review.
