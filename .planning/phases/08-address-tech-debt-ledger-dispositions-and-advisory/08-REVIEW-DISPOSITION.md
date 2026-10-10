---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A load failure skips the test instead of failing it, even with an explicit `PI_SUBAGENTS_ROOT` opt-in"
  - id: IN-01
    severity: info
    disposition: open
    title: "The two test files repeat the same helpers, and the HOME-ordering reason is documented in only one of them"
  - id: IN-02
    severity: info
    disposition: open
    title: "The ordering comment overstates where npm gets its global prefix"
  - id: IN-03
    severity: info
    disposition: open
    title: "The local `node_modules` does not match the bumped lock, so the local green check ran against 5.0.9"
  - id: IN-04
    severity: info
    disposition: open
    title: "A high-severity advisory remains on the nested Pi copy (known, tracked as DEPADV-01)"
---

# Phase 08 — Review Disposition

Per-finding ledger for `08-REVIEW.md` (critical 0, warning 1, info 4, total 5). Every row
starts `open`; the fix loop or a human updates the disposition.

| ID | Severity | Disposition | Note |
| --- | --- | --- | --- |
| WR-01 | warning | open | Pre-existing skip-on-any-failure in both resolver tests; the HOME bug hid behind it |
| IN-01 | info | open | Duplicated helpers across the two integration tests |
| IN-02 | info | open | Comment overstates the `~/.npmrc` prefix source |
| IN-03 | info | open | Local `node_modules` still holds 5.0.9; CI's `npm ci` is the first install of 5.0.12 |
| IN-04 | info | open | Nested Pi-shrinkwrapped copy stays vulnerable by design (DEPADV-01) |
