---
status: deferred
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
source: [02-VERIFICATION.md]
started: "2026-09-27T12:05:00.000Z"
updated: "2026-09-27T12:05:00.000Z"
---

## Current Test

number: 1
name: A real smart-HTTP endpoint that answers only at the verbatim path
expected: |
  `marketplace add <url>` succeeds against a REAL smart-HTTP git server that answers ONLY at
  the verbatim path and returns 404 for the `.git`-suffixed form, and a later
  `resolveRemoteRef` (e.g. `marketplace update`) also resolves against it.

  This proves isomorphic-git's smart-HTTP ref advertisement behaves against a real server the
  way the offline `createGitOpsFake` assumes. Every automated test in this phase asserts the
  URL that is SENT, via the fake's `allowedRemoteUrls`; none exercises a real HTTP round trip
  against a server that actually 404s the `.git` form.
awaiting: operator

## Tests

### 1. Live verbatim-only smart-HTTP endpoint

**Requirement:** MURL-08
**Status:** deferred — operator decision 2026-09-27

**How to run it:** serve a bare repo via `git http-backend` behind nginx (or any host you
control) configured to answer at `/<path>` and 404 `/<path>.git`. Then:

1. `marketplace add https://<host>/<path>` — expect success.
2. `marketplace update <name>` — expect the later `resolveRemoteRef` to resolve too.

**Why it is human-only:** it needs a real server, which this machine does not have. Named in
`02-VALIDATION.md`'s own Manual-Only Verifications table and not closed by any of the three
plans.

## Summary

One item, deferred by operator decision on 2026-09-27 so the autonomous run could proceed to
Phase 3. This mirrors Phase 1's still-open live-canary item: both block **milestone close**
only, not Phase 3.

Everything provable offline is closed — 9/9 must-haves verified, all 5 ROADMAP success
criteria, all 5 plan prohibitions, `npm run check` green at `CHECK_EXIT=0`, and the pre-phase
parser diffed byte-for-byte to confirm D-2-05's exception is exactly the sanctioned input shape.

## Gaps

None. The deferred item is an untested-by-design composition, not a known defect.
