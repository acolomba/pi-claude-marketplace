---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: wontfix
    title: "A legacy-write failure reports a server as dropped while `mcp.json` still holds it (TR-03 regression)"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A remote server with `headers` loses OAuth in pi-mcp-adapter, but keeps it in Claude Code"
  - id: WR-03
    severity: warning
    disposition: wontfix
    title: "A same-plugin key clash refuses after skills, commands, agents and hooks are committed, despite \"before any write\""
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "A per-tool `mcp:` entry for a tool the server does not report exactly fails the whole agent launch; the doc understates this"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The pull request's `fallow-audit` CI job will fail on the reshaped `plugin-info.ts` clone groups"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Folding broadens the self-replace exemption so that it skips the walk of the other sources for a renamed key"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "`translatedEntry`'s two warnings are unreachable in production after D-03-18"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "`authServerMetadataUrl` is accepted on the `https://` prefix alone; Claude also requires a valid URL"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "`info` prints `requires: pi-mcp-adapter` for a plugin whose MCP servers are all left out"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "The docs overstate key uniqueness across plugins"
open: 0
total: 10
recorded: 2026-10-06T20:21:10.102Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | wontfix | accepted in 03-UAT.md test 3: it needs a double write failure, and the reload move clears the both-files state |
| WR-02 | warning | fixed | 8cd7175f, de427118 (D-08-04); the review's "Claude keeps OAuth in both cases" holds only without an Authorization header |
| WR-03 | warning | wontfix | code accepted in 03-UAT.md test 1: the ledger rollback leaves a clean end state; the docs half (WR-03a) fixed in c2e89982 |
| WR-04 | warning | fixed | c2e89982 |
| WR-05 | warning | fixed | 3735e30a |
| IN-01 | info | fixed | 94097beb |
| IN-02 | info | fixed | 8cd7175f |
| IN-03 | info | fixed | 3c686fca |
| IN-04 | info | fixed | 9a8cf3a1 |
| IN-05 | info | fixed | c2e89982 |

`wontfix` is outside the code-review parser's `open|fixed|skipped|deferred` set, so a later
`/gsd-code-review` run on this phase would read it as `open`; this ledger was closed by hand
for the milestone debt (D-08 records).

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
