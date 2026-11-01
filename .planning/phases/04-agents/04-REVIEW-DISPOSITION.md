---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A `Skill(spec)` entry is not resolved to the Skill tool, so it neither grants nor disallows skill inheritance"
  - id: IN-01
    severity: info
    disposition: open
    title: "A full `claude-` model ID keeps a `[1m]` suffix, which an alias drops"
  - id: IN-02
    severity: info
    disposition: open
    title: "The thinking-fallback warning quotes the raw `effort`, not the level it emits"
  - id: IN-03
    severity: info
    disposition: open
    title: "An agent file named `.md`, or a folder whose name is not a safe name, now fails the whole install"
open: 4
total: 4
recorded: 2026-11-01T18:27:49.001Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
