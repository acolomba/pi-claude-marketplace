---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "The `x-access-token:` arm keeps the boundary and first-`@` limits that WR-02 and CR-01 removed elsewhere"
  - id: IN-02
    severity: info
    disposition: open
    title: "The Bearer secret span backtracks off trailing `+ / - . ~`, so `isTokenShaped` judges a truncated token"
  - id: IN-03
    severity: info
    disposition: open
    title: "Greedy userinfo can swallow a credential-free host when later text in the same authority segment holds an `@`"
  - id: IN-04
    severity: info
    disposition: open
    title: "Comments left stale by the WR-03 loader change"
  - id: IN-05
    severity: info
    disposition: open
    title: "A seam fixture's `message` field is dead data that restates its rows"
  - id: IN-06
    severity: info
    disposition: open
    title: "Redaction scope leaves common credential forms unhandled (carried from iteration 1, unchanged)"
  - id: IN-07
    severity: info
    disposition: open
    title: "`wireScope` and `wireVersion` sit at the cyclomatic ceiling (carried from iteration 1, unchanged)"
  - id: IN-08
    severity: info
    disposition: open
    title: "The wire `description` differs from what the text form shows (carried from iteration 1, unchanged)"
  - id: IN-09
    severity: info
    disposition: open
    title: "The shipped schema has no `$id` and cannot express the WIRE-05 summary rule (carried from iteration 1, unchanged)"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Userinfo redaction leaks the tail of a password that contains an unencoded `@`"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The Bearer pattern rewrites non-secret prose and crosses line breaks"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The token and userinfo patterns miss secrets next to a word character"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The marketplace LLM tool reads state twice, so content and details can disagree"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The catalog wire harness silently validates the wrong presentation when an `emit` fixture lacks `present`"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The credential-leak gate's \"text\" leg does not run the production text strategy"
  - id: WR-06
    severity: warning
    disposition: deferred
    title: "The JSON strategy emits payloads for raw surfaces that the text strategy suppresses"
open: 9
total: 16
recorded: 2026-10-04T02:04:03.525Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-02 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-03 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-04 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-05 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-06 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-07 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-08 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| IN-09 | info | open | 04-REVIEW.md iteration 2 (outside the critical_warning fix scope) |
| CR-01 | critical | fixed | 04-REVIEW-FIX.md iteration 1, commit 45449a48 (not in the current review) |
| WR-01 | warning | fixed | 04-REVIEW-FIX.md iteration 1, commit 6268a0be (not in the current review) |
| WR-02 | warning | fixed | 04-REVIEW-FIX.md iteration 1, commit a2f32c6e (not in the current review) |
| WR-03 | warning | fixed | 04-REVIEW-FIX.md iteration 1, commit 21f69324 (not in the current review) |
| WR-04 | warning | fixed | 04-REVIEW-FIX.md iteration 1, commit 53cab366 (not in the current review) |
| WR-05 | warning | fixed | 04-REVIEW-FIX.md iteration 1, commit 29ec1fc1 (not in the current review) |
| WR-06 | warning | deferred | ROADMAP Phase 5 success criterion 6 (the JSON strategy keeps the text strategy's empty no-ops); 04-REVIEW-FIX.md iteration 1 (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
