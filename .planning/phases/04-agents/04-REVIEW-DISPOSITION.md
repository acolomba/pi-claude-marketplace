---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: deferred
    title: "A full `claude-` model ID keeps a `[1m]` suffix, which an alias drops"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "The thinking-fallback warning quotes the raw `effort`, not the level it emits"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "An agent file named `.md`, or a folder whose name is not a safe name, now fails the whole install"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "A `Skill(spec)` entry is not resolved to the Skill tool"
open: 0
total: 4
recorded: 2026-11-01T18:33:37.405Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | deferred | Info, outside the Critical+Warning fix scope; D-CF4-07 text names the pass-through as is -- parent decides |
| IN-02 | info | deferred | Info, cosmetic warning text, outside the fix scope |
| IN-03 | info | deferred | Info, upstream handling of an empty agent name not measured; widens an existing behavior |
| WR-01 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
