---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A legacy-write failure reports a server as dropped while `mcp.json` still holds it (TR-03 regression)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "A remote server with `headers` loses OAuth in pi-mcp-adapter, but keeps it in Claude Code"
  - id: WR-03
    severity: warning
    disposition: open
    title: "A same-plugin key clash refuses after skills, commands, agents and hooks are committed, despite \"before any write\""
  - id: WR-04
    severity: warning
    disposition: open
    title: "A per-tool `mcp:` entry for a tool the server does not report exactly fails the whole agent launch; the doc understates this"
  - id: WR-05
    severity: warning
    disposition: open
    title: "The pull request's `fallow-audit` CI job will fail on the reshaped `plugin-info.ts` clone groups"
  - id: IN-01
    severity: info
    disposition: open
    title: "Folding broadens the self-replace exemption so that it skips the walk of the other sources for a renamed key"
  - id: IN-02
    severity: info
    disposition: open
    title: "`translatedEntry`'s two warnings are unreachable in production after D-03-18"
  - id: IN-03
    severity: info
    disposition: open
    title: "`authServerMetadataUrl` is accepted on the `https://` prefix alone; Claude also requires a valid URL"
  - id: IN-04
    severity: info
    disposition: open
    title: "`info` prints `requires: pi-mcp-adapter` for a plugin whose MCP servers are all left out"
  - id: IN-05
    severity: info
    disposition: open
    title: "The docs overstate key uniqueness across plugins"
open: 10
total: 10
recorded: 2026-10-06T20:21:10.102Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
