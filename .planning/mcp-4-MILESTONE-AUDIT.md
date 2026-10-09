---
milestone: mcp-4
audited: 2026-10-09T23:59:00Z
status: tech_debt
scores:
  requirements: 36/36
  phases: 7/7
  integration: 6/6
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: milestone (ship prep)
    items:
      - "PR blocker: `npx fallow audit --base 369eaec3` reads verdict `warn` with 14 clone groups (dead code 0, complexity 0). The Lint `fallow-audit` job fails a pull request on `warn`. Phase 3 UAT accepted WR-05 on the condition that a ship-prep task carries it."
      - "Version bump offer (0.20.0, D-07-11) is a PR-time act; not yet made."
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    items:
      - "01-VALIDATION.md is `status: draft` (Nyquist NOT-VALIDATED); no 01-SECURITY.md."
      - "11 info review findings open (01-REVIEW-DISPOSITION.md)."
      - "ROADMAP criterion 4 still names adapter 5.0.0 and engine 3.13.1 with no inline amendment note (amended by D-04-12, D-07-07, quick task 261006-kr1)."
      - "Global pi-subagents is 0.47.1: the two pi-subagents peer tests skip silently without a PI_SUBAGENTS_ROOT scratch install of 0.74.0."
  - phase: 02-adapter-file-delivery
    items:
      - "8 info findings deferred and WR-06 skipped (02-REVIEW-DISPOSITION.md)."
      - "Phase 5 (D-05-08..10) narrowed the never-lose-user-content promise: adapter-written leftovers under old names of moved servers are removed with a `leftover-removed` notice. Re-verification judged it an amendment, not a breach."
  - phase: 03-claude-code-tool-names-and-tool-search
    items:
      - "WR-01..05 and IN-01..05 still read `open` in 03-REVIEW-DISPOSITION.md; the operator accepted WR-01/02/03/05 as built in 03-UAT.md (2026-10-06), so the disposition file lags the decision."
      - "WR-03 wording: `docs/mcp-compatibility.md:27` says an install fails before it writes anything, while the refusal happens in the fifth ledger phase and rolls back."
  - phase: 04-variable-expansion-at-claude-code-parity
    items:
      - "9 info findings open (04-REVIEW-DISPOSITION.md)."
      - "MCPROW-01 (BACKLOG): review the `enable` and `import` row grammar when MCP notices follow."
  - phase: 05-automatic-migration-on-reload
    items:
      - "8 info findings open (05-REVIEW-DISPOSITION.md)."
      - "Open operator decision: whether `openUi` joins the D-02-06 carried-field set."
  - phase: 06-live-mcp-status-in-info
    items:
      - "IN-01, IN-02 open (06-REVIEW-DISPOSITION.md)."
      - "Pre-existing: `record.plugins[name]` lookups lack an own-property check (`info constructor@mp`); candidate BACKLOG item, not yet filed."
  - phase: 07-docs-and-live-proof
    items:
      - "One IN-06 sub-item skipped: an absolute path appears in operator-run canary output."
      - "MCPOVR-01 (BACKLOG): MCP server overrides do not survive plugin disable then enable."
nyquist:
  compliant_phases: ["02", "03", "04", "05", "06", "07"]
  partial_phases: []
  not_validated_phases: ["01"]
  missing_phases: []
  overall: partial
---

# Milestone mcp-4 (MCP 4) audit

**Goal:** make Pi 1.0 the baseline and deliver plugin MCP servers through
pi-mcp-adapter 5 at Claude Code parity, without adopting Pi's built-in MCP.

**Verdict:** `tech_debt`. All 36 requirements are satisfied, all 7 phases
are verified, cross-phase wiring is 6/6 and end-to-end flows are 6/6. No
critical gap exists. One debt item blocks the pull request: the fallow
audit verdict is `warn`.

## Evidence base

- Full gate: `npm run check` on `51ebbc07` (clean tree), Node v26.11.0,
  `PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0, exit 0. The next commit,
  `1b1e39a3`, touched only `.planning` markdown.
- Phases 1-6 read `stale` because later phases edited covered files. Each
  got a scoped re-verification at `51ebbc07` (targeted tests re-run,
  fingerprint refreshed through `verification.fingerprint`); all six still
  pass. Phase 7 passed on first verification, including a verifier re-run of
  the live canary against pi-mcp-adapter 5.2.0.

## Phases

| Phase | Verification | Score | Nyquist | Security | Review |
|-------|--------------|-------|---------|----------|--------|
| 1 Pi 1.0 floor and adapter-only detection | passed (re-verified) | 5/5 | draft | none | clean, 11 info open |
| 2 Adapter-file delivery | passed (re-verified) | 5/5 | compliant | 0 open | clean, 8 info deferred |
| 3 Claude Code tool names and tool search | passed (re-verified) | 5/7 + 2 decided | compliant | 0 open | 5 warnings accepted in UAT |
| 4 Variable expansion at Claude Code parity | passed (re-verified) | 5/5 | compliant | 0 open | 9 info open |
| 5 Automatic migration on /reload | passed (re-verified) | 4/4 | compliant | 0 open | clean, 8 info open |
| 6 Live MCP status in info | passed (re-verified) | 10/10 | compliant | 0 open | 2 info open |
| 7 Docs and live proof | passed | 3/3 | compliant | 0 open | 8/8 fixed |

## Requirements (3-source cross-reference)

Every REQ-ID is `[x]` and `Complete` in REQUIREMENTS.md, listed in at least
one SUMMARY `requirements-completed`, and satisfied in its phase
VERIFICATION.md. No orphans.

| Group | IDs | Phase | Status |
|-------|-----|-------|--------|
| Pi floor | PIFL-01..07 | 1 | satisfied (PIFL-03, PIFL-07 as amended by D-04-12, D-07-07) |
| Adapter detection | ADET-01, ADET-02 | 1 | satisfied |
| Adapter file | AFILE-01..06 | 2 | satisfied (as amended by ANAME-01, AMIG-02) |
| Names and search | ANAME-01..07 | 3 | satisfied (as amended by D-04-06, D-05-05) |
| Variables | AVAR-01..05 | 4 | satisfied |
| Migration | AMIG-01..04 | 5 | satisfied |
| Status | ASTAT-01, ASTAT-02 | 6 | satisfied |
| Docs | ADOC-01..03 | 7 | satisfied |

## Integration (gsd-integration-checker)

| Seam | Verdict | Requirements |
|------|---------|--------------|
| Every staging path (install, cascade, enable, import, update, reinstall, reconcile) goes through `prepareStageMcpServers` and finishes the legacy move | connected | AFILE, ANAME, AVAR, AMIG |
| Uninstall, disable and rollback remove by marker, write back user stubs, drop notices for removed servers | connected | AFILE-01/04/06, AVAR-04, ANAME-07 |
| One key builder (`domain/name.ts`) for stage, agent `tools:`, info status and migration | connected | ANAME-01/02/04, ASTAT |
| Adapter detection never blocks staging; `mcp` tag and status tracker wired | connected | PIFL, ADET, ASTAT |
| NFR-10 write set names `mcp-adapter.json` for every writer | connected | AFILE-01 |
| Docs, README, CHANGELOG and catalog match shipped behavior | connected | ADOC-01..03 |

Flows checked (all complete): install with the adapter missing; install with
an unset variable, then info and uninstall; update and reinstall; enable,
disable and cascade rollback; `/reload` migration; info status.

## Tech debt

See the `tech_debt` frontmatter. The items that need action before merge:

1. Clear the fallow audit `warn` (14 clone groups), or the Lint
   `fallow-audit` job fails the PR.
2. Offer the 0.20.0 version bump (D-07-11, AGENTS.md "Versioning").

Everything else is open info-level review findings, two BACKLOG entries
(MCPOVR-01, MCPROW-01), two unfiled candidates (`record.plugins` own-property
check, `openUi` carried field), Phase 1's draft validation and missing
security review, and two stale records (03-REVIEW-DISPOSITION.md,
ROADMAP Phase 1 criterion 4).
