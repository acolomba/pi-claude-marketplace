---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Main-session shutdown kills running async hooks"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Child shutdown never removes the rows of the hooks it stopped"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Concurrent-runner timeout can signal the test runner's own process group"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Docs say every other case keeps the row"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Main session kills a hook when the PID-table write fails"
  - id: IN-03
    severity: info
    disposition: skipped
    title: "Repeated session-match check in tool-result translators"
  - id: WR-03
    severity: warning
    disposition: deferred
    title: "Old load's late hook exits overwrite the new load's PID table after reload (pre-existing; BACKLOG ASYNCRELOADTABLE-01)"
open: 0
total: 7
recorded: 2026-11-14T00:45:00.000Z
---
