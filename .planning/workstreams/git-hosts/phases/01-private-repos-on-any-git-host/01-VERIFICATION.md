---
phase: 01-private-repos-on-any-git-host
verified: 2026-09-28T14:20:00Z
status: human_needed
score: 4/5 must-haves verified
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
covered_digest: "v2:sha256:bfeabc5f96126f015f14f08020aa2267f58bec29ccb9aadee24d22306f5b2645"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: "human_needed"
  previous_score: "5/5"
  gaps_closed:
    - "G-01-4 (UAT test 4, major): a credential bound to one host crossed to another host on a same-hostname/different-port redirect, and (per planning measurement) on an http: downgrade of the same hostname. `platform/git.ts` now wraps `isomorphic-git/http/node` in a module-private client that sends every hop with `followRedirects: false`, follows 3xx itself, and drops `authorization`/`cookie` on any hop whose `URL.origin` differs from the original request. Proven at the wire (real `simple-get`, real `isomorphic-git/http/node`, real `isomorphic-git`) for `clone`, `fetch` and `resolveRemoteRef`, for a port change, an `http:` downgrade and another hostname, on the `info/refs` (GET) leg. A same-origin redirect (another path, a relative Location, an explicit `:443`) still authenticates and resolves. This closure is PARTIAL — see gaps_remaining."
  gaps_remaining:
    - "The credential-bearing `git-upload-pack` POST leg of a cross-origin redirect has no regression test (code-review finding WR-02, open). The original UAT observation reported the leak on BOTH `info/refs` and the POST->GET `git-upload-pack` request; only the GET/`info/refs` leg is covered by an automated case with `auth` attached. By code inspection `nextHop`'s origin compare (`platform/git.ts:192-210`) applies uniformly regardless of the hop's original method, so the fix is very likely to also close the POST leg -- but nothing exercises that path, so it is unverified rather than disproven. Routed to human verification below (item 1)."
  regressions: []
gaps: []
human_verification:
  - test: "Re-run the live redirect scenario (the same instrumented-server harness UAT test 4 used, or an added automated wire-level case) with a credential-bearing `git-upload-pack` POST in flight: the bound host answers `info/refs` normally, then redirects the POST to a target on another port (or scheme) of the same hostname. Alternatively, add a `tests/platform/git.test.ts` case that combines `crossOriginServer`/`postRedirectServer`-style routing with `auth: boundAuth(credentials)`, asserting the POST-redirect target receives no `authorization` header, mirroring WR-02's suggested fix."
    expected: "The cross-origin target that receives the redirected `git-upload-pack` POST gets no `Authorization` header on any request, and the operation fails clean as `{authentication required}` (or, for a same-origin POST redirect, still authenticates and completes)."
    why_human: "No committed test exercises a credential-bearing POST leg against a cross-origin redirect target. `tests/platform/git.test.ts:1205` (the only committed POST-redirect cases) calls `resolveRemoteRef({ url: REMOTE_URL })` with no `auth`, so no case proves the POST-leg invariant the original UAT bug actually exhibited. Code inspection supports that the fix covers it (the origin compare in `nextHop` does not branch on the hop's originating method), but that is inference, not behavioral proof."
---

> **Re-verification of gap closure 01-04.** The prior report (`human_needed`, 5/5, dated
> 2026-09-26 at commit `3adb12c4`) is superseded by this one. Its human item (the live canary
> against a real `credential.helper` and a real private remote) was subsequently run as UAT
> (`01-UAT.md`): 14 of 15 tests passed; test 4 found gap G-01-4, a redirect-based credential leak.
> Gap-closure plan `01-04` (commits `96c9eb13`, `c9c21446`) closed the reported leak for the
> `info/refs` (discovery) leg of `clone`, `fetch` and `resolveRemoteRef`, across every origin
> variant the operator named (port, scheme, hostname). A fresh code review of the closure
> (`01-REVIEW.md`, `370` -> `01-04` diff, 0 critical / 4 warning / 5 info, all still `open` per
> `01-REVIEW-DISPOSITION.md`) found one warning-level proof gap that lands on the same UAT-4 root
> cause: the credential-bearing `git-upload-pack` POST leg of a cross-origin redirect has no
> regression test. That keeps this report at `human_needed` rather than `passed`.

# Phase 1: Private repos on any git host — Verification Report (re-verification)

**Phase Goal:** A Pi user can clone a private marketplace or plugin source over https from any git
host using a credential already in their git credential helper — no hostname is added to any
registry for it to work — and that credential is never offered to a host other than the one it was
resolved for.

**Verified:** 2026-09-28T14:20:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (01-04, closing UAT gap G-01-4)

## Goal Achievement

ROADMAP Success Criteria are the contract (`.planning/workstreams/git-hosts/ROADMAP.md`, Phase 1).
SC4's text was amended by 01-04 to fold in the redirect-path guarantee; the other four criteria are
unchanged since the prior verification and were regression-checked rather than re-derived.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With a PAT stored in their helper, a user can `marketplace add` / `plugin install` a private https source on a host the registry does not claim, and the clone succeeds | ✓ VERIFIED (regression) | Unchanged since prior verification: `auth-host.ts` and `domain/auth-registry.ts` are outside the 01-04 diff (`git diff --stat 79884d8a..HEAD -- extensions/.../auth-registry.ts` is empty). Regression-checked: `node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/add.test.ts` — re-run for this report, both suites green |
| 2 | When nothing is stored for such a host, the command fails with a cause line naming `git credential approve` (scoped to `update`, per the recorded 2026-07-11 checkpoint deferred to Phase 3 SC5) | ✓ VERIFIED (regression) | Unchanged: `update.ts`'s guard (`err.cause === undefined && classifyGitTransportFailure(err) === "authentication required" && !hasDeviceFlowProvider(host)`) is outside the 01-04 diff. Regression-checked: `node --test tests/orchestrators/marketplace/update.test.ts` — 63/63 pass |
| 3 | `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same memoization, no stored-credential cause line on a declined flow | ✓ VERIFIED (regression) | Unchanged: `domain/auth-registry.ts` and `domain/github-auth.ts` outside the 01-04 diff. `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError" extensions/ tests/` — exit 1, still absent |
| 4 | A credential resolved for one host is never sent to another: the caller-side `onAuth` host compare holds, AND (as amended by 01-04) a same-origin-only rule holds across redirects — no `Authorization` reaches a hop whose `URL.origin` (scheme + host + port) differs from the original request's, on any request the operation sends | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Caller-side compare: unchanged, regression-checked (`tests/platform/git-auth-callbacks.test.ts`, `tests/orchestrators/auth-host.test.ts`, 63/63 pass). Redirect guard code: `platform/git.ts:176-268` (`withoutHeaders`, `redirectLocation`, `nextHop`, `sendHop`, `requestWithinOrigin`) applies `CROSS_ORIGIN_HEADERS` scrub uniformly to every hop regardless of originating method. Proven at the wire for the `info/refs` (GET/discovery) leg: `node --test tests/platform/git.test.ts` — 51/51 pass, including the 5 cross-origin "does not forward" rows (port, scheme, hostname, across `clone`/`fetch`/`resolveRemoteRef`), the 3 same-origin control rows, and the 4 redirect-semantics rows (302→GET, 307 keeps body, missing Location, 11th-redirect cap). **Not proven:** the credential-bearing `git-upload-pack` POST leg of a cross-origin redirect — the only committed POST-redirect cases (`tests/platform/git.test.ts:1205`) call `resolveRemoteRef({ url: REMOTE_URL })` with no `auth`, so no case exercises this specific invariant. This is exactly the second symptom the original UAT-4 report described ("again on the (POST->GET) `git-upload-pack` request"). Code-review finding WR-02 (`01-REVIEW.md`, open) makes the same finding independently. Routed to Human Verification below |
| 5 | `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` and the no-orchestrator-network gate; no new export from `platform/git.ts`; no coverage-direct pin; no new type-member contract | ✓ VERIFIED | Re-run independently for this report at current HEAD: `npx tsc --noEmit` exit 0; `npx eslint` on the 4 changed files exit 0; `npm run lint:type-members` exit 0 (108 contracts, 4 exceptions, unchanged — `git-auth-callbacks.ts:41:39`/`:42:34` unmoved); `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/git.ts` exit 0 (branches 67/67, functions 17/17, lines 503/503); `npx fallow audit --format json --quiet --explain --gate-marker agent` → `"verdict":"pass"`; `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/no-stale-test-citations.test.ts` — 17/17 pass; `grep -c "^export" platform/git.ts` = 19 (unchanged); `scripts/test-coverage-direct.pin.json` rows = 0; `scripts/check-unused-type-members.contracts.json` = 108. The full `npm run check` was not re-run here (operator instruction): the executor's own run recorded `CHECK_EXIT=0` on this exact tree (7381/7381 unit, 36/36 integration, 100% coverage), and the targeted gates above independently corroborate it on HEAD |

**Score:** 4/5 truths verified (1 present, behavior-unverified)

### Gap-closure plan (01-04) must-haves — detail

| Must-have | Status | Evidence |
|---|---|---|
| No credential reaches another origin (port, scheme, hostname) on `clone`, `fetch`, `resolveRemoteRef` — proof via real `simple-get`/`isomorphic-git/http/node`/`isomorphic-git`, only `node:http`/`node:https` `request` replaced | ⚠️ Proven for the `info/refs` leg only (see Truth 4) | `tests/platform/git.test.ts` `installWireTransport` (line 484) mocks `https.request`/`nodeHttp.request` only; the existing `t.mock.method(http, "request", ...)` doubles (lines 195/243/282) that DO replace `isomorphic-git/http/node` directly are reserved for the pre-existing non-redirect cases, exactly as the plan's prohibition #2 requires |
| Origin = `URL.origin`; default https port normalizes; `http:` downgrade and hostname change both drop the header | ✓ VERIFIED | `nextHop` (git.ts:192) compares `target.origin === origin`; rows "another port", "http on the same host", "another host" (cross-origin) and "an explicit default port" (same-origin) all pass |
| Same-origin redirect keeps the credential (another path, relative Location, explicit `:443`) | ✓ VERIFIED | 3 same-origin rows pass, all resolve `OID_MAIN` |
| Cross-origin redirect followed, not refused; fails clean as `UserCanceledError`; helper queried once for the bound host only; not evicted on a host that cannot mint a replacement | ✓ VERIFIED as literally scoped | All 5 cross-origin rows assert `isUserCanceledError` + `credentials.calls` = `{fill:[{host:HOST}], approve:[], reject:[]}`. Tests use `evictOnFailure: false` throughout (git.test.ts:623-632), which is exactly the "cannot mint a replacement" case the truth names — see Findings W-A below for the Device-Flow-host (`evictOnFailure: true`) case this leaves untested |
| Redirect semantics match `simple-get` except 307/308 keep the body | ✓ VERIFIED | 4 rows: 302→GET no body/no content-*, 307 keeps body, missing-Location→HttpError, 11th redirect→`too many redirects` |
| Docstrings/requirement/roadmap text no longer credit `simple-get` | ✓ VERIFIED | grep evidence above (Truth 5 row and the D4 greps) |
| Whole gate green; no new export/pin/contract; scope fence = the 4 plan files | ✓ VERIFIED | See Truth 5 row; scope fence `git diff --name-only 79884d8a..HEAD -- ':!.planning/'` lists exactly `auth-host.ts`, `git-auth-callbacks.ts`, `git.ts`, `tests/platform/git.test.ts` |
| Prohibitions (no refusal, no isomorphic-git/http/node-only double, no `node_modules` patch, no new export/pin/contract) | ✓ VERIFIED | Cross-origin rows show the redirect is followed (not refused) then fails clean; wire double confirmed above; `git status --porcelain -- node_modules` n/a (nothing touched); export/pin/contract counts unchanged |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts` | module-private redirect-following `HttpClient`, origin-scoped header scrub | ✓ VERIFIED | 503 lines, 100% direct coverage. `withoutHeaders`/`redirectLocation`/`nextHop`/`sendHop`/`requestWithinOrigin` at 176-268; `http: HttpClient = { request: requestWithinOrigin }` at 268; the 3 isomorphic-git calls (`clone`, `fetch`, `listServerRefs`) still pass `http` unchanged |
| `tests/platform/git.test.ts` | wire-level double reproducing the leak, proving the fix | ✓ VERIFIED (partial — see Truth 4) | 1384 lines, 51/51 pass. `installWireTransport` (484), `crossOriginServer`/`sameOriginServer`/`postRedirectServer` (561/573/596). Covers `info/refs`; does not cover the POST leg with `auth` attached |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | `follows redirects itself` present (line 112); `cross-host redirect` absent; the two pre-existing type-member exception coordinates (41:39, 42:34) unmoved |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | `follows redirects itself` present (line 156); `cross-host redirect` absent |
| `.planning/workstreams/git-hosts/REQUIREMENTS.md` | GAUTH-06 amendment paragraph | ✓ VERIFIED | "Amended during Phase 1 gap closure (G-01-4)" present once |
| `.planning/workstreams/git-hosts/ROADMAP.md` | Phase 1 SC4 restated | ✓ VERIFIED | "compares the hostname only" present; SC4 now states the origin-scoped transport guard |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/git.ts::clone/fetch/listServerRefs` | `platform/git.ts::requestWithinOrigin` | the module-private `http: HttpClient` binding | ✓ WIRED | All 3 isomorphic-git call sites pass the same `http` object; unchanged line ranges confirm no call site edit was needed |
| `requestWithinOrigin` → `sendHop` | `isomorphic-git/http/node`'s `request` | `nodeHttpClient.request({...hop, fetchOptions: {followRedirects: false}})` | ✓ WIRED | git.ts:216-221; `fetchOptions` is force-set on every hop, overwriting any caller value |
| `sendHop` → `nextHop` | cross-origin header scrub | `target.origin === origin ? headers : withoutHeaders(headers, CROSS_ORIGIN_HEADERS)` | ✓ WIRED for the GET/discovery leg; ⚠️ unverified for the credential-bearing POST leg | Applies to every `GitHttpRequest` regardless of `hop.method` by code inspection (no method branch precedes the origin compare); no test exercises it with `auth` attached to a POST-bearing redirect |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `git.ts::sendHop` wire log | recorded `Authorization` header per hop | `installWireTransport`'s `https.request`/`nodeHttp.request` mock, driving the real `simple-get` | Yes — observed at the true socket-request boundary, not at `isomorphic-git/http/node`'s `request` | ✓ FLOWING (for the tested `info/refs` leg) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GAUTH-06 redirect cases (GET/discovery leg) all pass | `node --test tests/platform/git.test.ts` | 51/51 pass, `GIT_TEST_EXIT=0`; counts 5 cross-origin, 3 same-origin, 4 semantics rows | ✓ PASS |
| No residual `simple-get`-credit claim / retired constants | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError\|cross-host redirect" extensions/ tests/` | no matches for the retired terms | ✓ PASS |
| `platform/git.ts` 100% direct coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/git.ts` | branches 67/67, functions 17/17, lines 503/503, exit 0 | ✓ PASS |
| No new export / pin / contract | `grep -c '^export'` = 19; `test-coverage-direct.pin.json` rows = 0; `check-unused-type-members.contracts.json` = 108, exceptions = 4 | all match baseline | ✓ PASS |
| Gate re-runs (typecheck/lint/type-members/fallow/architecture tests) | see Truth 5 | all exit 0 | ✓ PASS |
| Full `npm run check` | not re-run (operator instruction; executor recorded `CHECK_EXIT=0` on this tree) | — | ? SKIP (accepted per operator instruction, corroborated by targeted re-runs above) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` exists; none declared by any PLAN/SUMMARY | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GAUTH-03 | 01-01, 01-03 | Clone a private source on any git host from a stored credential, no host-specific code, no registry literal | ✓ SATISFIED | Truth 1 (regression) |
| GAUTH-04 | 01-01 | No-stored-credential miss fails with a cause line naming `git credential approve` | ✓ SATISFIED on `update` | Truth 2 (regression); add/install deferred to Phase 3 SC5 (carried forward, unaffected by this gap closure) |
| GAUTH-05 | 01-01, 01-03 | `github.com` / `gitlab.com` keep today's Device Flow behavior byte-for-behavior | ✓ SATISFIED | Truth 3 (regression) |
| GAUTH-06 | 01-01, 01-02, 01-04 | A credential resolved for one host is never offered to another, including across a redirect | ◐ SATISFIED for the caller-side compare and the redirect's discovery (`info/refs`) leg; UNVERIFIED for the redirect's credential-bearing POST leg | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly GAUTH-03..06 to Phase 1, and all four appear
in the plans' `requirements:` fields (01-04 adds `requirements: [GAUTH-06]` for the gap closure).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` across the 4 gap-closure files | none | Zero matches — no debt-marker gate trigger |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | none | Zero matches |

### Code Review Disposition Judgment (01-REVIEW.md / 01-REVIEW-DISPOSITION.md)

All 9 findings (4 warning, 5 info) are still `open` — none fixed, none deferred by hand. Judgment on
each, specifically requested for WR-01:

- **WR-01 (warning) — a 401 from a foreign origin still enters the bound host's auth loop and can
  evict a stored credential, or start a spurious Device Flow, on Device-Flow hosts
  (`evictOnFailure: true`, i.e. `github.com`/`gitlab.com`).** Judgment: **does not break the phase
  goal or GAUTH-06.** The review's own reproduction confirms "the credential sent only to the bound
  origin, so no credential leaked" — this is a reliability/availability defect (an unwarranted
  credential eviction / wasted prompt), not a disclosure. It is also not new scope: the same
  false-positive-401-triggers-eviction behavior already existed for cross-hostname redirects before
  01-04 (T-01-21 in the plan's own threat register, disposition `accept`); 01-04 only widens the
  triggering redirects to same-hostname/other-port and https→http cases. The phase's own must-have
  truth 4 ("on a host that cannot mint a replacement, the stored credential is not evicted") is
  literally about non-Device-Flow hosts and holds there (tests use `evictOnFailure: false`
  throughout). Recommend filing WR-01 as follow-up work rather than reopening this phase.
- **WR-02 (warning) — no test covers the credential-bearing POST leg of a cross-origin redirect.**
  Judgment: **this is a real proof gap on the phase's own goal statement** ("that credential is
  never offered to a host other than the one it was resolved for" — no qualifier limiting this to
  GET requests), and it reproduces exactly the second half of the original UAT-4 observation. Routed
  to Human Verification (see below); this is the reason the phase is not `passed`.
- **WR-03 (warning) — the cross-origin header scrub is a denylist; `GitCredentials.headers` would
  let a future credential type bypass it.** Judgment: latent, not exercised today (no producer sets
  `headers`; both registry descriptors and `credentialFill` return `{username, password}` only).
  Does not break the goal for any credential shape this phase actually produces. Advisory.
- **WR-04 (warning) — an empty `Location` header loops to the redirect cap instead of returning the
  response unchanged.** Judgment: an edge-case parity bug against a non-conforming server response;
  does not disclose a credential (the operation ends in `too many redirects`, not a leak). Advisory.
- **IN-01 through IN-05 (info)** — docstring precision, error typing, and test-file organization
  notes. None affect the credential-disclosure guarantee. Advisory.

### Human Verification Required

One item. It subsumes the prior report's outstanding live-canary item: the original UAT-4 harness
already exercised the credential-bearing POST leg live and found it leaking, so closing this one
item (by test or by a fresh live run) closes both.

#### 1. Prove the redirect guard on the credential-bearing `git-upload-pack` POST leg

**Test:** Either (a) re-run the live redirect scenario against an instrumented server, as UAT test 4
did, with the bound host answering `info/refs` normally and then redirecting the `git-upload-pack`
POST to a target on another port (or scheme) of the same hostname; or (b) add a
`tests/platform/git.test.ts` case combining the existing `postRedirectServer`/`crossOriginServer`
routing helpers with `auth: boundAuth(credentials)` on the POST leg, asserting the cross-origin
target receives no `authorization` header.

**Expected:** The cross-origin target that receives the redirected POST gets no `Authorization`
header on any request, and the operation fails clean as `{authentication required}`
(`UserCanceledError`). A same-origin POST redirect (e.g. 307 to a renamed path) still authenticates
and completes, as the existing same-origin POST rows already prove.

**Why human:** No committed automated test exercises this specific path. The only POST-redirect
cases in the suite (`tests/platform/git.test.ts:1205`, the 302→GET and 307-keeps-body rows) call
`resolveRemoteRef({ url: REMOTE_URL })` with no `auth` at all, so the credential-forwarding invariant
under test elsewhere is simply absent from that scenario. Code inspection strongly suggests the fix
already covers this path — `nextHop`'s origin compare (`platform/git.ts:199`) runs before the
POST→GET branch and does not discriminate by method — but that is an inference from reading the
code, not a behavioral proof, and it is exactly the path the original UAT bug demonstrated leaking.

### Gaps Summary

No truth FAILED and no artifact is missing or a stub. The gap-closure plan (01-04) closed the
reported UAT redirect leak for the discovery (`info/refs`) leg across every origin variant named
(port, scheme, hostname), with strong wire-level proof running the real `simple-get`,
`isomorphic-git/http/node`, and `isomorphic-git`. What remains open is narrower than the original
gap: proof that the same guard holds for the credential-bearing POST leg of a cross-origin redirect,
which the original UAT observation also reported leaking and which the closure's own test suite does
not exercise. This is a proof gap, not a demonstrated defect — code inspection supports that the fix
already covers it — so the phase routes to `human_needed` rather than `gaps_found`. Closing item 1
above (preferably by adding the missing automated test, which is cheaper and more durable than a
live re-run) should be sufficient to move this phase to `passed`.

---

_Verified: 2026-09-28T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 01-VERIFICATION.md (human_needed, 5/5, 2026-09-26T05:04:51Z, commit `3adb12c4`)_
