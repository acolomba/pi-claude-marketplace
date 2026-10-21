---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "A github update whose stored credential the host rejects is told no credential was obtained"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The GAUTH-04 stored-credential predicate is now kept in two places"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "An early `BeforeAll` failure still leaks the run root, and the new comment says it cannot"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The `git-source.feature` description no longer covers what the file protects"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "The url kind's ref is echoed, never proven by content"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "After a branch diverges, republishing leaves the host half-updated"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "A comment line in `answer()` overruns the line width and breaks mid-sentence"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "In the `@` arm, the repo half can still contain `#`"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "The CHANGELOG does not mention the empty `#` ref divergence"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "The CHANGELOG puts the rejected-credential change under the GitHub base override"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "Doc comments still say a rejected credential reaches the classifiers as an `HttpError`"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "The rejected-credential CHANGELOG line says \"any git host\" and \"the cause reads\", but github.com and two verbs do not behave that way"
  - id: IN-09
    severity: info
    disposition: fixed
    title: "The `transportReason` ladder comment still leaves out a refused device-flow credential as a source of `UserCanceledError`"
open: 0
total: 13
recorded: 2026-10-21T17:07:55.789Z
---

# Phase 10: Code Review Disposition

Rendered by hand in the step's format: the `--auto` loop renumbered findings across three re-reviews (iter2/iter3 backups) and the scripted reconciliation kept only the last two. Sources are the fix commits recorded in 10-REVIEW-FIX.md.

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 51a1937a |
| WR-02 | warning | fixed | 7e0c0dae |
| WR-03 | warning | fixed | 4d21d34c |
| WR-04 | warning | fixed | b25d84c6 |
| IN-01 | info | fixed | 442eb7c5 |
| IN-02 | info | fixed | 0df7e3fc |
| IN-03 | info | fixed | 3a2610ed |
| IN-04 | info | deferred | doc fix 4a4f70b9; parser tightening declined (it would move away from upstream's first-@ split; the D-76-04 parity question is with the user) |
| IN-05 | info | fixed | 9214555c |
| IN-06 | info | fixed | 13fd212c, reworded by efdf6fa0 (IN-08) |
| IN-07 | info | fixed | 175d590c |
| IN-08 | info | fixed | efdf6fa0 |
| IN-09 | info | fixed | 9d21b5e8 |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
