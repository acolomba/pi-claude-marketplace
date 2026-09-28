---
phase: 01-private-repos-on-any-git-host
verified: 2026-09-28T16:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/workstreams/git-hosts/REQUIREMENTS.md
  - .planning/workstreams/git-hosts/ROADMAP.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-01-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-01-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-02-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-02-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-03-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-03-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-04-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-04-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-CONTEXT.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-REVIEW-DISPOSITION.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-REVIEW.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-SECURITY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-UAT.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-VALIDATION.md
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - tests/platform/git.test.ts
covered_digest: "v2:sha256:17835298461cfaff42a98d9a3d63ff029bcd3f45ce09cfbbaeb48c7ed1b31ce4"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "passed"
  previous_score: "5/5"
  gaps_closed:
    - "No gaps were open in the prior report (it was already `passed`). This round closes the prior report's one recorded Advisory recommendation: commit a2db444e adds 5 automated wire-level tests to tests/platform/git.test.ts that drive the credential-bearing git-upload-pack POST leg of a cross-origin redirect directly (port, hostname, scheme, and a 302 POST→GET variant, plus a same-origin 307 control) — the exact gap the prior report's WR-02 disposition and Advisory section named as still resting on live-UAT-only evidence."
  gaps_remaining: []
  regressions: []
gaps: []
human_verification: []
---

> **Re-verification, triggered by staleness only.** The prior report (`passed`, 5/5, dated
> 2026-09-28T15:35:00Z, committed at `538eedfe`) went `stale` because its `covered_files` list
> includes files that changed afterward: `git diff --stat 538eedfe..HEAD -- extensions/` is empty
> (confirmed below) — **no production file changed**. Three commits landed after it: two doc-only
> commits (`3c07b6eb` 01-VALIDATION.md, `6403aa37` 01-SECURITY.md) and one test-only commit
> (`a2db444e`, +127 lines to `tests/platform/git.test.ts`) that adds automated coverage for exactly
> the gap the prior report's Advisory section flagged as open: proof that the redirect guard also
> covers the credential-bearing `git-upload-pack` POST leg, not just the `info/refs` discovery GET
> leg. This report re-verifies from scratch rather than assume the prior narrative, and records the
> WR-02 disposition change the new test closes.

# Phase 1: Private repos on any git host — Verification Report (re-verification)

**Phase Goal:** A Pi user can clone a private marketplace or plugin source over https from any git
host using a credential already in their git credential helper — no hostname is added to any
registry for it to work — and that credential is never offered to a host other than the one it was
resolved for.

**Verified:** 2026-09-28T16:30:00Z
**Status:** passed
**Re-verification:** Yes — staleness only (no production code changed since the prior `passed`
report; new automated test coverage landed for a previously-live-only-verified path)

## Goal Achievement

ROADMAP Success Criteria are the contract (`.planning/workstreams/git-hosts/ROADMAP.md`, Phase 1,
5 criteria). `git diff --stat 538eedfe..HEAD -- extensions/` returns nothing — confirmed empty —
so no production behavior changed since the prior verification. Every gate below was re-run fresh
on the current tree.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With a PAT stored in their helper, a user can `marketplace add` / `plugin install` a private https source on a host the registry does not claim, and the clone succeeds | ✓ VERIFIED | Carried forward — no production change. `node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/add.test.ts` re-run green as part of the full `npm run check` below. Live evidence: 01-UAT.md test 2 |
| 2 | When nothing is stored for such a host, the command fails with a cause line naming `git credential approve` (scoped to `update`, per the recorded 2026-07-11 checkpoint deferred to Phase 3 SC5) | ✓ VERIFIED | Carried forward — no production change. `tests/orchestrators/marketplace/update.test.ts` green in the full run. Live evidence: 01-UAT.md test 3 |
| 3 | `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same memoization, no stored-credential cause line on a declined flow | ✓ VERIFIED | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError" extensions/ tests/` — no matches (retired). Domain/auth-registry untouched |
| 4 | A credential resolved for one host is never sent to another: the caller-side `onAuth` host compare holds, AND a same-origin-only rule holds across redirects — no `Authorization` reaches a hop whose `URL.origin` (scheme + host + port) differs from the original request's, on any request the operation sends (GET discovery leg AND the credential-bearing POST leg) | ✓ VERIFIED | Caller-side compare: `tests/platform/git-auth-callbacks.test.ts`, `tests/orchestrators/auth-host.test.ts` — green. Redirect guard, GET/discovery leg: unchanged, part of `tests/platform/git.test.ts`. Redirect guard, credential-bearing POST leg: **now closed by automated test, not just live UAT.** Commit `a2db444e` adds `authenticatedPostRedirectServer` plus 5 new named tests to `tests/platform/git.test.ts` — read in full (see below) — that drive `resolveRemoteRef` through a bound-origin, authenticated `git-upload-pack` POST that is then redirected: 3 cross-origin 307 rows (another port, `http:` on the same host, another host) plus one 302 POST→GET cross-origin row all assert the redirect target's `wireCredentials` entry is `authorization: null` while the bound-origin requests before it carry the real `BASIC_CREDENTIAL`; a same-origin 307 control asserts the opposite (`authorization: BASIC_CREDENTIAL` at the renamed same-origin URL) and the clone succeeds. All 5 run and pass by name (`node --test --test-name-pattern="git-upload-pack POST redirect"` → 5/5). Live evidence (01-UAT.md test 16) still stands as independent, directly-observed corroboration against a real server |
| 5 | `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` and the no-orchestrator-network gate; no new export from `platform/git.ts`; no coverage-direct pin; no new type-member contract | ✓ VERIFIED | Fresh full run for this report: `npm run check > check2.log 2>&1; echo CHECK_EXIT=$?` (unpiped) → `CHECK_EXIT=0`. `all files` coverage `100.00 \| 100.00 \| 100.00`. Unit `7386/7386` pass (5 more than the prior report's 7381 — exactly the 5 new GAUTH-06 POST tests); integration `36/36` pass. `lint:type-members` — 4 pre-existing exceptions, unchanged. `grep -c "^export" platform/git.ts` = 19 (unchanged); `test-coverage-direct.pin.json` `.rows` = 0 (unchanged); `check-unused-type-members.contracts.json` `.contracts` length = 108 (unchanged). `npx fallow audit --format json --quiet --explain --gate-marker agent` → `AUDIT_EXIT=0`, `"verdict":"pass"` (re-run independently for this report). `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/import-boundaries.test.ts` — 22/22 pass |

**Score:** 5/5 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts` | module-private redirect-following `HttpClient`, origin-scoped header scrub | ✓ VERIFIED | Unchanged since `538eedfe` (no production diff). `sendHop`'s origin compare (`git.ts:199`, `target.origin === origin ? headers : withoutHeaders(...)`) sits before any method-specific branch — confirmed by direct read, and now exercised by name against a POST hop, not just inferred from code inspection. 100% direct coverage in the fresh coverage table |
| `tests/platform/git.test.ts` | wire-level double reproducing the leak, proving the fix | ✓ VERIFIED for both the GET/discovery leg and the credential-bearing POST leg | 56/56 pass (was 51/51). New: `authenticatedPostRedirectServer` helper (line ~617) plus `CROSS_ORIGIN_POST_REDIRECTS` table and two standalone tests (302 POST→GET cross-origin, same-origin 307 control) drive the POST leg directly. Reviewed the diff in full — assertions are non-vacuous: each row asserts the exact `wireCredentials` sequence (URL + `authorization` value, `null` vs the real `BASIC_CREDENTIAL`) rather than a bare "did not throw" |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | Unchanged since `538eedfe` |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | Unchanged since `538eedfe` |
| `.planning/workstreams/git-hosts/REQUIREMENTS.md` | GAUTH-06 amendment paragraph | ✓ VERIFIED | "Amended during Phase 1 gap closure (G-01-4)" present; GAUTH-03..06 all marked `[x]`; coverage table (lines 119-122) lists all four `Complete` |
| `.planning/workstreams/git-hosts/ROADMAP.md` | Phase 1 SC4 restated | ✓ VERIFIED | "compares the hostname only" present; SC4 states the origin-scoped transport guard; all 4 phase plans marked `[x]` |
| `.planning/workstreams/git-hosts/phases/.../01-UAT.md` | 16/16 human tests pass, gap G-01-4 resolved | ✓ VERIFIED | `total: 16 / passed: 16 / issues: 0`; `gaps:` entry for G-01-4 has `status: resolved`, `resolved_by: 01-04-PLAN.md` |
| `.planning/workstreams/git-hosts/phases/.../01-VALIDATION.md` | validation strategy reconstructed post-execution | ✓ VERIFIED | `status: validated`, `nyquist_compliant: true`; documents the same test infrastructure/commands used in this re-verification |
| `.planning/workstreams/git-hosts/phases/.../01-SECURITY.md` | threat register, threats_open = 0 | ✓ VERIFIED | `threats_open: 0`; T-01-15/T-01-16 (redirect-forwarded credential threats) already cite `a2db444e`'s wire tests plus UAT 4/16 as mitigation evidence, consistent with this report |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/git.ts::clone/fetch/listServerRefs` | `platform/git.ts::requestWithinOrigin` | the module-private `http: HttpClient` binding | ✓ WIRED | Unchanged; all 3 isomorphic-git call sites pass the same `http` object |
| `sendHop` → `nextHop` | cross-origin header scrub | `target.origin === origin ? headers : withoutHeaders(headers, CROSS_ORIGIN_HEADERS)` | ✓ WIRED, now proven for both the GET/discovery leg and the POST leg by automated test | The POST leg is no longer inferred from "no method branch precedes the origin compare" alone — it is now directly exercised by 5 named tests in `a2db444e`, all passing |
| `update.ts` cause attachment | `NO_STORED_CREDENTIAL_CAUSE` / `hasDeviceFlowProvider` | `err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(host))` guarded by `!hasDeviceFlowProvider(host)` | ✓ WIRED | Unchanged; `tests/orchestrators/marketplace/update.test.ts` green in the full run |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `git.ts::sendHop` wire log | recorded `Authorization` header per hop, GET/discovery leg | `installWireTransport`'s `https.request`/`nodeHttp.request` mock, driving the real `simple-get` | Yes — observed at the true socket-request boundary | ✓ FLOWING |
| `git.ts::sendHop` wire log | recorded `Authorization` header per hop, credential-bearing `git-upload-pack` POST leg | Same wire-transport mock, driven through `authenticatedPostRedirectServer` (new in `a2db444e`) | Yes — observed at the true socket-request boundary, automated | ✓ FLOWING (newly automated; previously human-only) |
| Live-server `Authorization` header log | per-request auth state on an instrumented HTTPS/HTTP server | operator-run harness (`01-UAT.md` test 16) | Yes — real socket traffic, human-observed | ✓ FLOWING (independent corroboration, unchanged) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Named POST-redirect GAUTH-06 tests pass | `node --test --test-name-pattern="git-upload-pack POST redirect" tests/platform/git.test.ts` | 5/5 pass | ✓ PASS |
| Full `tests/platform/git.test.ts` | `node --test tests/platform/git.test.ts` | 56/56 pass (was 51/51) | ✓ PASS |
| `sendHop` origin compare precedes any method branch (code read, not inferred) | `sed -n '196,232p' extensions/pi-claude-marketplace/platform/git.ts` | line 199 origin compare unconditional; line 200 POST→GET conversion only follows it | ✓ PASS |
| No residual `simple-get`-credit claim / retired constants | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError\|cross-host redirect" extensions/ tests/` | no matches | ✓ PASS |
| `platform/git.ts` 100% direct coverage | via the full `npm run check` coverage table | branches/functions/lines all 100.00 | ✓ PASS |
| No new export / pin / contract | `grep -c '^export'` = 19; `.pin.json .rows` = 0; `.contracts.json .contracts` length = 108, 4 lint:type-members exceptions unchanged | all match prior baseline | ✓ PASS |
| Combined auth/credential-leak/architecture suites | `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/import-boundaries.test.ts` | 22/22 pass | ✓ PASS |
| Full `npm run check` | `npm run check > check2.log 2>&1; echo CHECK_EXIT=$?` (not piped) | `CHECK_EXIT=0`; unit 7386/7386, integration 36/36, coverage 100.00/100.00/100.00 | ✓ PASS |
| `fallow audit` | `npx fallow audit --format json --quiet --explain --gate-marker agent` | `AUDIT_EXIT=0`, `"verdict":"pass"` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` exists; none declared by any PLAN/SUMMARY | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GAUTH-03 | 01-01, 01-03 | Clone a private source on any git host from a stored credential, no host-specific code, no registry literal | ✓ SATISFIED | Truth 1 |
| GAUTH-04 | 01-01 | No-stored-credential miss fails with a cause line naming `git credential approve` | ✓ SATISFIED on `update` | Truth 2; add/install deferred to Phase 3 SC5 (carried forward, unaffected) |
| GAUTH-05 | 01-01, 01-03 | `github.com` / `gitlab.com` keep today's Device Flow behavior byte-for-behavior | ✓ SATISFIED | Truth 3 |
| GAUTH-06 | 01-01, 01-02, 01-04 | A credential resolved for one host is never offered to another, including across a redirect, on every leg of the request | ✓ SATISFIED | Truth 4 — GET leg and POST leg both now covered by automated test; UAT test 16 is independent corroboration |

No orphaned requirements: REQUIREMENTS.md maps exactly GAUTH-03..06 to Phase 1, and all four appear
in the plans' `requirements:` fields (01-01: GAUTH-03/04/05; 01-02: GAUTH-06; 01-03: GAUTH-03/05;
01-04: GAUTH-06, gap closure). All four are marked `[x]` in REQUIREMENTS.md and `Complete` in its
coverage table.

### Advisory (New Scope, Unevidenced)

This verifier's own Step 7 anti-pattern scan (debt markers, stub patterns, hollow props) over the
14 phase-touched source/test files (13 from the prior report plus `01-VALIDATION.md`/`01-SECURITY.md`
added this round) produced zero new-scope 🛑 Blocker findings.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | — | — | None |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` across all phase-touched source/test files | none | Zero matches — no debt-marker gate trigger |

### Code Review Disposition (01-REVIEW.md / 01-REVIEW-DISPOSITION.md)

`01-REVIEW-DISPOSITION.md` still records all 9 findings (4 warning, 5 info) `open` — the file itself
was not edited this round (out of scope for this verification pass; only VERIFICATION.md was
written). This verifier's own judgment, updated for WR-02:

- **WR-01 (warning)** — unchanged from the prior report. A foreign-origin 401 during a redirect
  still enters the bound host's auth loop and can evict a stored credential or trigger a spurious
  Device Flow on Device-Flow hosts. Does not break the phase goal or GAUTH-06 (credential is sent
  only to the bound origin). Outside the 5 stated success criteria. Recommend filing as follow-up
  work.
- **WR-02 (warning)** — **the disposition file's own stated closing condition is now met.** Its
  title reads "No test covers a redirect of the credential-bearing `git-upload-pack` POST" — commit
  `a2db444e` adds exactly that test, reviewed above and confirmed non-vacuous and passing by name.
  The must-have this gap concerned (Truth 4 / GAUTH-06 on the POST leg) was already `✓ VERIFIED` in
  the prior report via live UAT; this round adds durable automated regression coverage for the same
  guarantee, closing the durability recommendation the prior report's Advisory section raised. The
  disposition file's `open` status is stale bookkeeping, not a live gap — flagged here for whoever
  next edits `01-REVIEW-DISPOSITION.md`, not corrected by this verifier (scope limits this pass to
  `VERIFICATION.md` only).
- **WR-03 (warning)** — unchanged. Denylist vs. allowlist header scrub; latent, no current producer
  of `GitCredentials.headers`. Advisory.
- **WR-04 (warning)** — unchanged. An empty `Location` header loops to the redirect cap instead of
  returning the response unchanged; fails clean, discloses nothing. Advisory.
- **IN-01 through IN-05 (info)** — unchanged. Docstring precision, error typing, test-file
  organization. Do not affect the credential-disclosure guarantee. Advisory.

### Human Verification Required

None. All 5 truths are automated-test-verified (Truth 4's previously live-only leg is now also
covered by `a2db444e`'s named tests). `01-UAT.md`'s 16/16 pass remains as independent corroborating
evidence, not the sole proof for any must-have.

### Gaps Summary

None. All 5 ROADMAP success criteria for Phase 1 are verified: no truth failed, no artifact is
missing or a stub, every key link is wired, and the whole gate (`npm run check`, `fallow audit`,
architecture tests) is green on a fresh run against the current tree. `git diff --stat
538eedfe..HEAD -- extensions/` is empty, confirming no production behavior changed since the prior
`passed` verification — this report re-verifies fresh rather than trusting that narrative, and the
only material change found is a strict improvement: 5 new automated tests closing the one
durability recommendation (WR-02 automated coverage) the prior report left open as an Advisory item.

Three non-blocking, out-of-scope-for-this-phase findings remain recorded `open` in
`01-REVIEW-DISPOSITION.md` (WR-01, WR-03, WR-04 — none describe a credential disclosure) plus 5
info-level notes, unchanged from the prior report. WR-02's disposition entry is stale relative to
this report's evidence (see Code Review Disposition above) but that is a bookkeeping note for the
disposition file's next edit, not a phase-blocking gap.

---

_Verified: 2026-09-28T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 01-VERIFICATION.md (passed, 5/5, 2026-09-28T15:35:00Z, committed 538eedfe) —
went stale due to covered-file changes (a2db444e test additions, 3c07b6eb/6403aa37 doc additions),
not due to any finding in this re-verification_
