---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "`listRemotes` returns `url: undefined` on its `origin` arm and crashes `recognizeLeftover` with a raw `TypeError`"
  - id: WR-01
    severity: warning
    disposition: open
    title: "`addGitClonedInGuard`'s JSDoc now documents `recognizeLeftover`'s position; the function itself is undocumented"
  - id: WR-02
    severity: warning
    disposition: open
    title: "the leftover-removal leak is computed, joined, attached, and then discarded on the standalone command path"
  - id: WR-03
    severity: warning
    disposition: open
    title: "a user-placed clone of the same repository under `sources/<name>` is recognized and removed unconditionally"
  - id: WR-04
    severity: warning
    disposition: open
    title: "recognition resolves through a symlinked destination that the removal will not traverse"
  - id: WR-05
    severity: warning
    disposition: open
    title: "`GitOps`'s own JSDoc still says \"Seven primitives\" after `listRemotes` became the eighth"
  - id: WR-06
    severity: warning
    disposition: open
    title: "the `add.ts` module flow header still documents an unconditional pre-clone stale-clone refusal"
  - id: WR-07
    severity: warning
    disposition: open
    title: "four comments narrate code that no longer exists, against the project comment policy"
  - id: WR-08
    severity: warning
    disposition: open
    title: "`recognizeLeftover` takes five positional parameters against the file's args-object convention"
  - id: WR-09
    severity: warning
    disposition: open
    title: "each MA-14 test runs two complete act/assert cycles in one case"
  - id: WR-10
    severity: warning
    disposition: open
    title: "no test covers the `[remote \"origin\"]`-without-`url` config shape behind CR-01"
  - id: IN-01
    severity: info
    disposition: open
    title: "the new permission-based tests pass vacuously as root"
  - id: IN-02
    severity: info
    disposition: open
    title: "`stripGitSuffix`'s parameter is named `path` although it takes a URL"
  - id: IN-03
    severity: info
    disposition: open
    title: "the MA-14 leak assertions check substrings rather than the whole value"
  - id: IN-04
    severity: info
    disposition: open
    title: "the `else if (finalDir !== undefined)` cleanup arm silently drops `leftoverLeak`"
  - id: IN-05
    severity: info
    disposition: open
    title: "a case-differing re-type of the same source cannot recognize its own leftover, and the row gives no hint"
  - id: IN-06
    severity: info
    disposition: open
    title: "`pathExists` and `listRemotes` are two reads of the same destination"
open: 17
total: 17
recorded: 2026-09-27T16:55:33.923Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| WR-10 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
