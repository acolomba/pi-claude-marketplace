---
milestone: mcp-4
audited: 2026-10-10T09:30:00Z
status: passed
scores:
  requirements: 41/41
  phases: 8/8
  integration: 12/12
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 08-clear-milestone-debt
    items:
      - "ROOTKEY-01 (BACKLOG, carried): `install __proto__@<mp>` and any root plugin name outside the dependency token alphabet (for example `_x@mp`) are refused correctly, but the cause line says the plugin 'declares an unusable dependency'. Pre-existing behavior in `domain/dependency-closure.ts`; found and pinned by the 08-19 end-to-end test; WINDOWS entry 90 waived to this carrier."
  - phase: milestone (ship prep)
    items:
      - "PR-time acts: the version bump offer (0.20.0, D-07-11) and the CHANGELOG `[Unreleased]` lines for the debt-clearing changes (OAuth beside headers, choices kept across disable/uninstall, enable/import MCP notices as separate warnings, the new migration remedies)."
      - "Commit 8578407a lacks the attribution trailers; history cannot be rewritten (recorded in 08-20-SUMMARY)."
nyquist:
  compliant_phases: ["01", "02", "03", "04", "05", "06", "07", "08"]
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: compliant
---

# Milestone mcp-4 (MCP 4) audit

**Goal:** make Pi 1.0 the baseline and deliver plugin MCP servers through
pi-mcp-adapter 5 at Claude Code parity, without adopting Pi's built-in MCP.

**Verdict: passed.** This re-audit follows Phase 8 (clear milestone debt),
which the operator added after the 2026-10-09 audit (status `tech_debt`, 488bec50).
Every item that audit listed is now fixed or closed with a recorded reason. One
new minor item found during Phase 8, ROOTKEY-01, is carried in BACKLOG.

## Evidence base

- HEAD `f09a4e59` on `features/mcp-4`. `npm run check` with both peer roots
  (`PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0, `PI_SUBAGENTS_ROOT` =
  pi-subagents 0.74.0) exited 0 after the last code commit (9ed88725 changed
  only a comment and a test title; its hook ran `check:commit` green).
- `npx fallow audit --base $(git merge-base origin/main HEAD)`: verdict `pass`,
  0 introduced, 8 inherited clone groups; no `ignoredClones`, 22 reviewed
  `fallow-ignore` markers.
- All eight phase reports read `passed` through `verification.status`. Phases
  1-7 were re-verified in scope on 2026-10-10 (baseline 1b1e39a3, or 51ebbc07
  for Phase 7; head 3df6309c) because Phase 8 edited files they cover. No truth
  lost support. Phase 2's re-verification found one hygiene gap (Phase 8 put
  `D-02-19` back in a comment and a test title); 9ed88725 closed it.

## Phases

| Phase | Verification | Nyquist | Security | Review ledger |
|-------|--------------|---------|----------|---------------|
| 1 Pi 1.0 floor and adapter-only detection | passed 5/5 | compliant | verified, 0 open | open: 0 |
| 2 Adapter file delivery | passed (gap 2 closed) | compliant | verified | open: 0 |
| 3 Claude Code tool names and tool search | passed | compliant | verified | open: 0 |
| 4 Variable expansion at Claude Code parity | passed 5/5 | compliant | verified | open: 0 |
| 5 Automatic migration on reload | passed 4/4 | compliant | verified | open: 0 |
| 6 Live MCP status in info | passed 10/10 | compliant | verified | open: 0 |
| 7 Docs and live proof | passed 3/3 | compliant | verified | open: 0 |
| 8 Clear milestone debt | passed 5/5 | compliant | verified, 41/41 closed | 7/7 fixed |

## Requirements (3-source cross-reference)

41/41 satisfied. Every ID is checked off in `REQUIREMENTS.md`, listed in some
SUMMARY's `requirements-completed`, and covered by a `passed` VERIFICATION.
No orphans.

| Group | IDs | Phase | Status |
|-------|-----|-------|--------|
| Pi 1.0 floor, detection | PIFL-01..07, ADET-01..02 | 1 | satisfied |
| Adapter file delivery | AFILE-01..06 | 2 | satisfied |
| Tool names and tool search | ANAME-01..07 | 3 | satisfied |
| Variable expansion | AVAR-01..05 | 4 | satisfied |
| Migration on reload | AMIG-01..04 | 5 | satisfied |
| Live status | ASTAT-01..02 | 6 | satisfied |
| Docs and live proof | ADOC-01..03 | 7 | satisfied |
| Milestone debt | DEBT-01..05 | 8 | satisfied |

## Integration (gsd-integration-checker)

12/12 wirings wired, 6/6 end-to-end flows complete, no broken seam. The
checker ran 8 integration and architecture suites (113 pass) and traced the
rest by code reading. New Phase 8 seams checked: the per-server choice store
(`{ plugin, marketplace, fields }`) across stage, unstage, migration, update,
reinstall and disable/enable; the explicit staging environment from every
entry factory; the OAuth decision against expansion and credential withholding;
own-key reads across 33 modules; the `source-outdated` row from probe to
catalog; docs and catalog against code.

Flows: install to `mcp-adapter.json` to `info`; uninstall then reinstall;
update that drops then restores a server; disable then enable; reload
migration of legacy `mcp.json`; remote OAuth server with headers.

## Closed since the 2026-10-09 audit

- PR blocker: fallow audit `warn` -> `pass` (08-01, 08-06, 08-15).
- Phase 1 Nyquist and security gaps -> validated, 23 threats closed.
- All open, deferred and skipped review findings in phases 1-7 -> fixed (74)
  or wontfix with a reason (7); `07-REVIEW-DISPOSITION.md` written.
- ROADMAP criterion 4, PIFL-07 and STATE ADET-02 wording match the code.
- MCPOVR-01 closed (choices survive disable/enable and uninstall/reinstall;
  `openUi` and `trace` carried). MCPROW-01 closed (adapter-loaded enable and
  import shapes pinned; SEV-01 kept).
- Own-key reads (`info constructor@mp` and friends) and `__proto__` refused as
  a name (OWNKEY-01).

## Tech debt

- ROOTKEY-01 (minor, pre-existing, carried in BACKLOG with evidence and a
  pinned test).
- Ship prep: version bump offer and CHANGELOG lines at PR time; commit
  8578407a has no attribution trailers (cannot be amended).
