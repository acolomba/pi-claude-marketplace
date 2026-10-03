---
phase: 01
review: 01-REVIEW.md
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "pi.sh loaded pi-mcp-adapter 5 against the real Pi home"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Prompt or skill sourced from pi-mcp-adapter counted as the adapter"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "RPC test trusted empty lists without the evidence steps"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Sentinel cleanup registered after a read that can throw"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "pi-subagents optional peer flag not asserted"
  - id: IN-01
    severity: info
    disposition: open
    title: "Doc comments still say the probe reads only `getAllTools()`"
  - id: IN-02
    severity: info
    disposition: open
    title: "Live-UAT driver mocks do not define `getCommands`"
  - id: IN-03
    severity: info
    disposition: open
    title: "The README does not state the new pi-subagents floor"
  - id: IN-04
    severity: info
    disposition: open
    title: "The `dispatchRow` change removes the value's type before it casts"
  - id: IN-05
    severity: info
    disposition: open
    title: "Three copies of a local `toolInfo` helper remain"
  - id: IN-06
    severity: info
    disposition: open
    title: "An unexplained clone between the two canary drivers replaces the explained one"
  - id: IN-07
    severity: info
    disposition: open
    title: "The OpenAI stub server has no error handlers"
  - id: IN-08
    severity: info
    disposition: open
    title: "The ADET-02 doc comment has an over-long line and a garbled clause"
  - id: IN-09
    severity: info
    disposition: open
    title: "`readPid` accepts an empty or non-numeric PID file, and a missing sentinel file now pre-empts the clean-session diagnosis"
  - id: IN-10
    severity: info
    disposition: open
    title: "The pi.sh sandbox default has no regression guard, and the fresh home's missing credentials are not documented"
  - id: IN-11
    severity: info
    disposition: open
    title: "Inventory and command readers still turn a shape change into an empty list"
open: 11
total: 16
recorded: 2026-10-03T01:07:22Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | cd50c39b (01-REVIEW-FIX.md) |
| WR-01 | warning | fixed | d1e24ebd (01-REVIEW-FIX.md) |
| WR-02 | warning | fixed | 440968b4 (01-REVIEW-FIX.md) |
| WR-03 | warning | fixed | 440968b4 (01-REVIEW-FIX.md) |
| WR-04 | warning | fixed | c3488792 (01-REVIEW-FIX.md) |
| IN-01 | info | open | 01-REVIEW.md iteration 2 |
| IN-02 | info | open | 01-REVIEW.md iteration 2 |
| IN-03 | info | open | 01-REVIEW.md iteration 2 |
| IN-04 | info | open | 01-REVIEW.md iteration 2 |
| IN-05 | info | open | 01-REVIEW.md iteration 2 |
| IN-06 | info | open | 01-REVIEW.md iteration 2 |
| IN-07 | info | open | 01-REVIEW.md iteration 2 |
| IN-08 | info | open | 01-REVIEW.md iteration 2 |
| IN-09 | info | open | 01-REVIEW.md iteration 2 |
| IN-10 | info | open | 01-REVIEW.md iteration 2 |
| IN-11 | info | open | 01-REVIEW.md iteration 2 |
