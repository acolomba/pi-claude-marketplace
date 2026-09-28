---
phase: 01-private-repos-on-any-git-host
verified: 2026-09-28T15:35:00Z
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
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-UAT.md
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
covered_digest: "v2:sha256:2d43a2d78f19c3a73d65694e4e3ac76a61eb6c084bd55c0af159b7546bb03bdf"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "human_needed"
  previous_score: "4/5"
  gaps_closed:
    - "The one open human-verification item (WR-02: the credential-bearing git-upload-pack POST leg of a cross-origin redirect had no proof) is closed by 01-UAT.md test 16, run live against an instrumented HTTPS/HTTP server through pi 0.87.1 RPC mode. It drove the POST leg specifically (info/refs served normally, only the git-upload-pack POST redirected) across port, hostname and scheme cross-origin variants plus a same-origin 307 control: every cross-origin target received no Authorization header and the operation failed clean as {authentication required}; the same-origin redirect still authenticated and completed."
  gaps_remaining: []
  regressions: []
gaps: []
human_verification: []
---

> **Re-verification, closing gap-closure 01-04's remaining human item.** The prior report
> (`human_needed`, 4/5, dated 2026-09-28T14:20:00Z) held one open human-verification item: proof
> that the redirect guard (`platform/git.ts`, landed in 01-04) also covers the credential-bearing
> `git-upload-pack` POST leg of a cross-origin redirect, not just the `info/refs` (discovery) GET
> leg that 01-04's own automated tests exercised. `01-UAT.md` test 16 closes it: a live run against
> an instrumented server, driving the POST leg specifically across port/hostname/scheme cross-origin
> variants and a same-origin control, through `pi 0.87.1` RPC mode. No code changed between the
> prior report and this one (`git log` shows only doc/UAT commits after `96c9eb13`/`c9c21446`); this
> report re-ran every gate fresh rather than trusting the carried-forward narrative.

# Phase 1: Private repos on any git host — Verification Report (re-verification)

**Phase Goal:** A Pi user can clone a private marketplace or plugin source over https from any git
host using a credential already in their git credential helper — no hostname is added to any
registry for it to work — and that credential is never offered to a host other than the one it was
resolved for.

**Verified:** 2026-09-28T15:35:00Z
**Status:** passed
**Re-verification:** Yes — closing the human-verification item left open after gap closure 01-04

## Goal Achievement

ROADMAP Success Criteria are the contract (`.planning/workstreams/git-hosts/ROADMAP.md`, Phase 1,
5 criteria). No production code changed since the prior verification (`git log --oneline` between
`c9c21446` and `HEAD` is doc/UAT commits only), so every gate below was re-run fresh on the current
tree rather than carried forward from the prior report's narrative.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With a PAT stored in their helper, a user can `marketplace add` / `plugin install` a private https source on a host the registry does not claim, and the clone succeeds | ✓ VERIFIED | Re-run for this report: `node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/add.test.ts` — green (part of the 263/263 combined run below). Live evidence: 01-UAT.md test 2 (`marketplace add` against a real private repo on `localhost:8443` with a stored PAT) |
| 2 | When nothing is stored for such a host, the command fails with a cause line naming `git credential approve` (scoped to `update`, per the recorded 2026-07-11 checkpoint deferred to Phase 3 SC5) | ✓ VERIFIED | Re-run: `node --test tests/orchestrators/marketplace/update.test.ts` — 63/63 pass. Live evidence: 01-UAT.md test 3 |
| 3 | `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same memoization, no stored-credential cause line on a declined flow | ✓ VERIFIED | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError" extensions/ tests/` — no matches (retired). Domain/auth-registry untouched since `f4f98c66` |
| 4 | A credential resolved for one host is never sent to another: the caller-side `onAuth` host compare holds, AND a same-origin-only rule holds across redirects — no `Authorization` reaches a hop whose `URL.origin` (scheme + host + port) differs from the original request's, on any request the operation sends (GET discovery leg AND the credential-bearing POST leg) | ✓ VERIFIED | Caller-side compare: `tests/platform/git-auth-callbacks.test.ts`, `tests/orchestrators/auth-host.test.ts` — green, re-run. Redirect guard, GET/discovery leg: `node --test tests/platform/git.test.ts` — 51/51 pass, re-run fresh for this report (5 cross-origin "does not forward" rows across `clone`/`fetch`/`resolveRemoteRef` for port/scheme/hostname, 3 same-origin control rows, 4 redirect-semantics rows). Redirect guard, credential-bearing POST leg: **closed by live human verification**, `01-UAT.md` test 16 — an instrumented server where `info/refs` served normally and only the `git-upload-pack` POST was redirected; every cross-origin target (port, hostname, scheme, and a 302 POST→GET variant) received `auth=none` and the operation failed clean as `{authentication required}`, while a same-origin 307 POST redirect still authenticated (`auth=VALID`) and completed. This is a directly-observed behavioral proof against a real server, not an inference from code reading — see Advisory for the still-open recommendation to also add an automated regression test for this path (`tests/platform/git.test.ts` currently drives the POST-redirect table with no `auth` attached) |
| 5 | `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` and the no-orchestrator-network gate; no new export from `platform/git.ts`; no coverage-direct pin; no new type-member contract | ✓ VERIFIED | Fresh full run for this report: `npm run check > LOG 2>&1; echo CHECK_EXIT=$?` → `CHECK_EXIT=0`. `all files` coverage row `100.00 \| 100.00 \| 100.00`; `auth-host.ts`, `marketplace/update.ts`, `marketplace/add.ts`, `git-auth-callbacks.ts`, `platform/git.ts` all `100.00 \| 100.00 \| 100.00` with no uncovered-lines cell. Unit `7381/7381` pass, integration `36/36` pass. `lint:type-members` — 4 pre-existing exceptions, unchanged (`git-auth-callbacks.ts:41:39`/`:42:34`). `grep -c "^export" platform/git.ts` = 19 (unchanged); `test-coverage-direct.pin.json` rows = 0; `check-unused-type-members.contracts.json` = 108. `npx fallow audit --format json --quiet --explain --gate-marker agent` → `AUDIT_EXIT=0`, `"verdict":"pass"` (re-run independently for this report). `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/import-boundaries.test.ts` — green |

**Score:** 5/5 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts` | module-private redirect-following `HttpClient`, origin-scoped header scrub | ✓ VERIFIED | 100% direct coverage (re-confirmed via the full `npm run check` coverage table). Three isomorphic-git calls (`clone`, `fetch`, `listServerRefs`) still pass the same `http` binding |
| `tests/platform/git.test.ts` | wire-level double reproducing the leak, proving the fix | ✓ VERIFIED for the GET/discovery leg; POST leg proven by live UAT, not by this file | 51/51 pass. `POST_REDIRECTS` table (line 1174) still calls `resolveRemoteRef({ url: REMOTE_URL })` with no `auth` — unchanged since the prior report |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | `follows redirects itself` present (line 112); `cross-host redirect` absent; two pre-existing type-member exceptions unmoved |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | `follows redirects itself` present (line 156); `cross-host redirect` absent |
| `.planning/workstreams/git-hosts/REQUIREMENTS.md` | GAUTH-06 amendment paragraph | ✓ VERIFIED | "Amended during Phase 1 gap closure (G-01-4)" present; GAUTH-03..06 all marked `[x]` |
| `.planning/workstreams/git-hosts/ROADMAP.md` | Phase 1 SC4 restated | ✓ VERIFIED | "compares the hostname only" present; SC4 states the origin-scoped transport guard |
| `.planning/workstreams/git-hosts/phases/.../01-UAT.md` | 16/16 human tests pass, gap G-01-4 resolved | ✓ VERIFIED | `total: 16 / passed: 16 / issues: 0`; `gaps:` entry for G-01-4 has `status: resolved`, `resolved_by: 01-04-PLAN.md` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/git.ts::clone/fetch/listServerRefs` | `platform/git.ts::requestWithinOrigin` | the module-private `http: HttpClient` binding | ✓ WIRED | All 3 isomorphic-git call sites pass the same `http` object |
| `sendHop` → `nextHop` | cross-origin header scrub | `target.origin === origin ? headers : withoutHeaders(headers, CROSS_ORIGIN_HEADERS)` | ✓ WIRED, proven for GET/discovery leg by automated test and for the POST leg by live UAT (test 16) | Applies to every `GitHttpRequest` regardless of `hop.method` by code inspection (no method branch precedes the origin compare); the POST leg is now behaviorally proven, not just inferred |
| `update.ts` cause attachment | `NO_STORED_CREDENTIAL_CAUSE` / `hasDeviceFlowProvider` | `err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(host))` guarded by `!hasDeviceFlowProvider(host)` | ✓ WIRED | `node --test tests/orchestrators/marketplace/update.test.ts` — 63/63 pass, re-run |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `git.ts::sendHop` wire log | recorded `Authorization` header per hop | `installWireTransport`'s `https.request`/`nodeHttp.request` mock, driving the real `simple-get` | Yes — observed at the true socket-request boundary | ✓ FLOWING (GET/discovery leg, automated) |
| Live-server `Authorization` header log | per-request auth state on an instrumented HTTPS/HTTP server | operator-run harness (`01-UAT.md` test 16), driven through `pi` RPC mode against real isomorphic-git/simple-get | Yes — real socket traffic, human-observed | ✓ FLOWING (credential-bearing POST leg, human-verified) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GAUTH-06 redirect cases (GET/discovery leg) all pass | `node --test tests/platform/git.test.ts` | 51/51 pass | ✓ PASS |
| Combined auth/credential-leak/architecture suites | `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/import-boundaries.test.ts tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/marketplace/add.test.ts` | 263/263 pass | ✓ PASS |
| No residual `simple-get`-credit claim / retired constants | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError\|cross-host redirect" extensions/ tests/` | no matches | ✓ PASS |
| `platform/git.ts` 100% direct coverage | via the full `npm run check` coverage table | branches/functions/lines all 100.00 | ✓ PASS |
| No new export / pin / contract | `grep -c '^export'` = 19; `test-coverage-direct.pin.json` rows = 0; `check-unused-type-members.contracts.json` = 108, exceptions = 4 | all match baseline | ✓ PASS |
| Full `npm run check` | `npm run check > LOG 2>&1; echo CHECK_EXIT=$?` (not piped) | `CHECK_EXIT=0`; 7381/7381 unit, 36/36 integration, 100.00/100.00/100.00 coverage | ✓ PASS |
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
| GAUTH-06 | 01-01, 01-02, 01-04 | A credential resolved for one host is never offered to another, including across a redirect, on every leg of the request | ✓ SATISFIED | Truth 4 — GET leg by automated test, POST leg by live UAT test 16 |

No orphaned requirements: REQUIREMENTS.md maps exactly GAUTH-03..06 to Phase 1, and all four appear
in the plans' `requirements:` fields (01-01: GAUTH-03/04/05; 01-02: GAUTH-06; 01-03: GAUTH-03/05;
01-04: GAUTH-06, gap closure). All four are marked `[x]` in REQUIREMENTS.md.

### Advisory (New Scope, Unevidenced)

This verifier's own Step 7 anti-pattern scan (debt markers, stub patterns, hollow props) over the
13 phase-touched source/test files produced zero new-scope 🛑 Blocker findings. None.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | — | — | None |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` across all 13 phase-touched source/test files | none | Zero matches — no debt-marker gate trigger |

### Code Review Disposition (01-REVIEW.md / 01-REVIEW-DISPOSITION.md)

All 9 findings from the 01-04 incremental review (4 warning, 5 info) are still recorded `open` — none
marked `fixed`/`skipped`/`deferred` by hand. This verifier's judgment, unchanged from the prior report
except for WR-02 (now closed as a must-have by live evidence):

- **WR-01 (warning)** — a foreign-origin 401 during a redirect still enters the bound host's auth
  loop and can evict a stored credential or trigger a spurious Device Flow on Device-Flow hosts.
  **Does not break the phase goal or GAUTH-06** — the review's own reproduction shows the credential
  is sent only to the bound origin (no disclosure); this is a reliability/availability defect, and it
  already existed for cross-hostname redirects before 01-04 (T-01-21, `accept`). Outside the 5 stated
  success criteria. Recommend filing as follow-up work.
- **WR-02 (warning)** — **now closed as a must-have.** `01-UAT.md` test 16 is a directly-observed,
  live proof that the guard holds on the credential-bearing POST leg across port/hostname/scheme
  cross-origin variants, with a same-origin control. The disposition file still shows it `open`
  because no *automated* regression test was added — see Advisory. That gap is a durability/coverage
  concern for future regressions, not an unproven phase goal today.
- **WR-03 (warning)** — denylist vs. allowlist header scrub; latent, no current producer of
  `GitCredentials.headers`. Advisory.
- **WR-04 (warning)** — an empty `Location` header loops to the redirect cap instead of returning the
  response unchanged; fails clean, discloses nothing. Advisory.
- **IN-01 through IN-05 (info)** — docstring precision, error typing, test-file organization. Do not
  affect the credential-disclosure guarantee. Advisory.

### Human Verification Required

None. The one open item from the prior report (proof of the redirect guard on the credential-bearing
POST leg) is closed by `01-UAT.md` test 16, a live, directly-observed run against an instrumented
server covering every origin variant (port, hostname, scheme) plus a same-origin control.

### Gaps Summary

None. All 5 ROADMAP success criteria for Phase 1 are verified: no truth failed, no artifact is
missing or a stub, every key link is wired, and the whole gate (`npm run check`, `fallow audit`,
architecture tests) is green on a fresh run against the current tree. The phase goal — a stored
credential reaches any git host, and that credential is never offered to a host other than the one it
was resolved for, including across a redirect on any leg of the request — is met.

Two non-blocking, out-of-scope-for-this-phase findings remain recorded `open` in
`01-REVIEW-DISPOSITION.md` (WR-01, an eviction/reliability defect on Device-Flow hosts; WR-03/WR-04,
latent/edge-case robustness gaps) plus 5 info-level notes. None of them describe a credential
disclosure and none contradict any of the 5 success criteria this phase states. Recommended as
follow-up work, not as phase-blocking gaps.

One durability recommendation: add the automated regression test WR-02 suggests
(`tests/platform/git.test.ts`'s `POST_REDIRECTS` table with `auth: boundAuth(storedCredentials())`
attached) so the credential-bearing-POST-leg proof does not depend on a repeatable live run going
forward. This is recorded as an advisory finding, not a gap — the live evidence already closes the
phase's must-have truth.

---

_Verified: 2026-09-28T15:35:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 01-VERIFICATION.md (human_needed, 4/5, 2026-09-28T14:20:00Z)_
