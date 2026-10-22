---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The ADD-04 `Given` says the copy \"can be added\", and the scenario then shows that it cannot"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "The doc comment of `publishMarketplaceIn` still describes git-kind behavior that the function does not have (carried over from round 2)"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "`publishMarketplaceIn` and `requireFreeRoot` take adjacent `string` parameters that are easy to swap (carried over from round 2)"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "The two ADD-06 steps use `directory` for different things (carried over from round 2)"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "The remove feature description claims more than its one scenario observes (carried over from round 2)"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "Leftovers after the round-2 fixes"
  - id: IN-06
    severity: info
    disposition: deferred
    title: "The ADD-06 comment borrows a rationale that does not apply to ADD-06"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "The ADD-04 copy is identical to the first marketplace in everything but its location"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The kind-shared step \"is also published in the directory\" names a filesystem directory for the url rows"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`the marketplace {string} is published as a {source kind} source` does not assert that its directory is free"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The WR-05 fix anchors the gate rationale to ADD-07, which does not state it"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Decision IDs D-01 and D-04 now mean two different decisions in the suite"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The \"another marketplace\" Given does not assert that its setup leaves the first marketplace intact"
open: 0
total: 13
recorded: 2026-10-16T13:57:04.344Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 03-REVIEW-FIX.md |
| IN-01 | info | deferred | Info, outside the critical/warning fix scope: the git-kind doc sentence of publishMarketplaceIn waits for the url/github stand-ins (Phases 9-10) |
| IN-02 | info | deferred | Info, outside the fix scope: two adjacent string parameters of publishMarketplaceIn; an options object can come with the git kinds |
| IN-03 | info | deferred | Info, outside the fix scope: the two ADD-06 steps name their placeholder differently; wording only |
| IN-04 | info | deferred | Info, outside the fix scope: remove.feature's description outgrows its one scenario until Phase 4 extends the file |
| IN-05 | info | deferred | Info, outside the fix scope: breakManifest wrapper, the location path built in two lib functions, and the requireFreeRoot message wording |
| IN-06 | info | deferred | Info, outside the fix scope: the ADD-06 comment borrows the excluded-rows reason and points 'above' by position |
| IN-07 | info | fixed | 0061bcd5: orchestrator-granted Info fix in the final round (the copy offers its own plugin, so only the shared name explains the failure) |
| WR-02 | warning | fixed | 03-REVIEW-FIX.iter3.md (not in the current review) |
| WR-03 | warning | fixed | 03-REVIEW-FIX.iter3.md (not in the current review) |
| WR-04 | warning | fixed | 03-REVIEW-FIX.iter3.md (not in the current review) |
| WR-05 | warning | fixed | 03-REVIEW-FIX.iter2.md (not in the current review) |
| WR-06 | warning | fixed | 03-REVIEW-FIX.iter2.md (not in the current review) |


Rounds: round 1 (0 critical, 6 warning, 5 info) fixed WR-02..WR-06 in
258ccb32..9cff4690; its WR-01 (check that a failed add leaves nothing behind)
was skipped because it contradicts locked decision D-05, and that id was
reused by later rounds. Round 2 (4 warning, 5 info) fixed all four warnings
in 9834bfa3..2d537559. Round 3 (1 warning, 7 info) fixed WR-01 (d6609998)
and IN-07 (0061bcd5). The table above reflects the final round's ids.

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
