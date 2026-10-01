---
status: complete
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
source: [02-VERIFICATION.md]
started: "2026-09-27T12:05:00.000Z"
updated: "2026-09-28T21:00:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Live verbatim-only smart-HTTP endpoint

**Requirement:** MURL-08
expected: `marketplace add <url>` succeeds against a real smart-HTTP server that answers only at the verbatim path and 404s the `.git` form, and a later `marketplace update` also resolves against it
result: pass
evidence: "Run by Claude on 2026-09-28 against a local instrumented server (Node HTTPS + git http-backend, self-signed cert via NODE_EXTRA_CA_CERTS, every request logged) serving a bare repo only at https://localhost:8445/verbatim-mp and returning 404 for any `.git`-suffixed path, driven through pi 0.87.1 RPC mode with the branch's extension. add: `● canary-marketplace [project] (added)`, wire = GET /verbatim-mp/info/refs + POST /verbatim-mp/git-upload-pack, state.json records kind url with url `https://localhost:8445/verbatim-mp` verbatim. A commit bumping the manifest to 1.1.0 was pushed, then update: `● canary-marketplace [project] (updated)`, same two verbatim requests, clone HEAD at the new commit with version 1.1.0. No `.git` form was ever requested. Controls: add https://localhost:8445/nope and add https://localhost:8445/verbatim-mp.git each made one info/refs request, got 404, and failed as `⊘ ... (failed) {source missing}` with no state.json written."
**Status:** closed 2026-09-28 (deferred 2026-09-27 by operator decision)

**How to run it:** serve a bare repo via `git http-backend` behind nginx (or any host you
control) configured to answer at `/<path>` and 404 `/<path>.git`. Then:

1. `marketplace add https://<host>/<path>` — expect success.
2. `marketplace update <name>` — expect the later `resolveRemoteRef` to resolve too.

**Why it is human-only:** it needs a real server, which this machine does not have. Named in
`02-VALIDATION.md`'s own Manual-Only Verifications table and not closed by any of the three
plans.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

The single item was deferred by operator decision on 2026-09-27 and closed on 2026-09-28 against
a local stand-in server (see test 1 evidence).

Everything provable offline is closed — 9/9 must-haves verified, all 5 ROADMAP success
criteria, all 5 plan prohibitions, `npm run check` green at `CHECK_EXIT=0`, and the pre-phase
parser diffed byte-for-byte to confirm D-2-05's exception is exactly the sanctioned input shape.

## Gaps

None. The deferred item is an untested-by-design composition, not a known defect.
