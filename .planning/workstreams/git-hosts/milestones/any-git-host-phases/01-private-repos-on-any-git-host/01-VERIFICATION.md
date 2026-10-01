---
phase: 01-private-repos-on-any-git-host
verified: 2026-09-30T12:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
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
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/platform/git-auth-callbacks.test.ts
  - tests/platform/git.test.ts
covered_digest: "v2:sha256:5330bb97fd455ec619f8efdfffeec0ddaeba140aec1e14d09806302651b082ec"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "passed"
  previous_score: "5/5"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps: []
human_verification: []
---

> **Re-verification, triggered by staleness (#4682).** The prior report (`passed`, 5/5, dated
> 2026-09-28T22:50:00Z) went `stale` because commits landed after it that touch covered files:
> `505dc912`, `23cc2218`, `ae8ce217`, `62ec0fa6` and `c1286475`; `main` was then merged back in
> and the branch tree equals `main` at `a0d3aef1` (PR #221). `c1286475` is substantive for this
> phase: the auth bundle gained a `kind` discriminant (`device-flow` | `stored-credential`)
> replacing `evictOnFailure`; the builders split into `buildAuthForHost` / `buildCloneAuth` /
> `buildStoredCredentialAuth`; `marketplace update` now keys its stored-credential cause line on
> `auth.kind` (`hasDeviceFlowProvider` removed); `materializePluginClone` /
> `materializeOrRefreshPluginMirror` now require an auth bundle. This report re-verifies every
> must-have against the CURRENT code from scratch rather than trusting the prior narrative. The
> per-file inventory of changes since the prior report's base (`9de84814`) was taken with
> `git diff --stat 9de84814..HEAD -- extensions tests`.

# Phase 1: Private repos on any git host — Verification Report (re-verification)

**Phase Goal:** A Pi user can clone a private marketplace or plugin source over https from any git
host using a credential already in their git credential helper — no hostname is added to any
registry for it to work — and that credential is never offered to a host other than the one it was
resolved for.

**Verified:** 2026-09-30T12:00:00Z
**Status:** passed
**Re-verification:** Yes — after `c1286475` (auth-bundle `kind` discriminant refactor) and four
smaller style/doc commits; no regression found

## Goal Achievement

ROADMAP Success Criteria are the contract (`.planning/workstreams/git-hosts/ROADMAP.md`, Phase 1,
5 criteria). Every truth below was re-derived from the code as it stands at HEAD.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With a PAT stored in their helper, a user can `marketplace add` / `plugin install` a private https source on a host the registry does not claim, and the clone succeeds | ✓ VERIFIED | `orchestrators/auth-host.ts::buildAuthForHost` returns `buildStoredCredentialAuth(host, credentialOps)` (a `stored-credential` bundle) whenever `findProviderForHost(host) === undefined`, so a bundle exists for EVERY host. `platform/git-auth-callbacks.ts::onAuth` then reaches `opts.credentialOps.fill(opts.host)` on both kinds and returns the filled credential on a hit. Wiring: `add.ts` (`addGitHubInGuard`/`addUrlInGuard`) and `update.ts` call `buildAuthForHost`; the plugin install / reinstall / fetch / `info --fetch` / update probes call `buildCloneAuth`; `update-preflight.ts` calls `buildCloneAuth` or `buildStoredCredentialAuth` (autoupdate cascade, no ctx, D-3-04). `git.ts` `clone`/`fetch`/`resolveRemoteRef` each call `buildAuthCallbacks(opts.auth)`. `domain/auth-registry.ts` still has exactly two descriptors (`github.com`, `gitlab.com`), no hostname literal added. Tests: `auth-host.test.ts` "forwards an unregistered host's stored credential through the real auth callbacks" and "returns a stored-credential bundle for an unregistered host without notifying" pass; `git-auth-callbacks.test.ts` "returns a stored credential for a stored-credential bundle" passes. Live evidence: 01-UAT.md test 2 |
| 2 | When nothing is stored for such a host, the command fails with a cause line naming `git credential approve` (scoped to `update`, per the 2026-07-11 checkpoint deferring add/install to Phase 3 SC5) | ✓ VERIFIED | `auth-host.ts::NO_STORED_CREDENTIAL_CAUSE(host)` contains the `printf ... \| git credential approve` remedy. `update.ts::refreshUrlClone` attaches it as the chain tail when `err.cause === undefined`, `classifyGitTransportFailure(err) === "authentication required"` and `auth.kind === "stored-credential"`. Tests pass in `update.test.ts`: "GAUTH-04: a cancelled credential lookup on a host with no Device Flow renders {authentication required} plus the stored-credential cause line" (exact-message `deepStrictEqual` incl. the `git credential approve` text), "GAUTH-04: a 401 challenge ... carries the same stored-credential cause line", and "GAUTH-04: a transport error that already carries a cause keeps its own chain". Live evidence: 01-UAT.md test 3 |
| 3 | `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same memoization, and the bare `{authentication required}` row on a declined flow with NO stored-credential cause line | ✓ VERIFIED | Re-checked against the `c1286475` refactor specifically. `buildAuthForHost` returns a `device-flow` bundle (with the memoizing `onAuthRequired` closure over `authMemo`, once-per-host) for any host `findProviderForHost` claims; `update.ts::refreshUrlClone` attaches the cause line ONLY when `auth.kind === "stored-credential"`, so a registry host (declined/expired Device Flow) never gets it. The github-SOURCE arm of `refreshRecord` builds its bundle from `GITHUB_HOST` and never enters the cause branch at all. The old `hasDeviceFlowProvider` is gone (`grep -rn "hasDeviceFlowProvider\|evictOnFailure\|NO_PROVIDER_CAUSE" extensions tests` -> no matches). Host-case fold: `hostFromCloneUrl` reads `new URL().host`, which lowercases, so a url source typed `GitHub.com` still resolves to the registered host (covered). Tests pass: `update.test.ts` "GAUTH-05: a cancelled Device Flow on a github.com url refresh renders {authentication required} with NO stored-credential cause line" (exact `deepStrictEqual` on `fetchedAuth.kind === "device-flow"` and on the notification message, which ends at `-> cancelled` with no cause tail), "marketplace update transport: carries the GitHub auth bundle without invoking Device Flow", and "GAUTH-02: a declined/failed Device Flow (UserCanceledError) on refresh renders {authentication required}"; `auth-host.test.ts` "forwards a credential miss through the complete GitLab bundle", "reruns an injected GitHub Device Flow when the memo is omitted", "returns the same-host memo entry without repeating authentication", "isolates memo entries and provider arguments across different hosts". Note: the autoupdate cascade (`update-preflight.ts`, no notification context) asks for a `stored-credential` bundle on every host incl. github.com and cancels without Device Flow (D-3-04, recorded project decision, Phase 3 scope); the cause line is attached only in `update.ts::refreshUrlClone`, so this does not falsify GAUTH-05 |
| 4 | A credential resolved for one host is never sent to another: the caller-side `onAuth` host compare holds, AND a same-origin-only rule holds across redirects — no `Authorization` reaches a hop whose `URL.origin` differs from the original request's, on any request the operation sends (GET discovery leg AND the credential-bearing POST leg) | ✓ VERIFIED | Caller side: `git-auth-callbacks.ts::onAuth` requires `requested.protocol === "https:"` and `requested.host === opts.host` before ANY helper query, cancelling otherwise (unparseable URL is caught by the CP-10 catch and cancels). The compare runs before the `kind` branch, so it guards both bundle kinds. `onAuthFailure` on a `stored-credential` bundle skips `credentialOps.reject` (a rejected stored credential is the user's only copy, GAUTH-04/D-1-01) and always cancels. Transport side: `platform/git.ts` `CROSS_ORIGIN_HEADERS = {authorization, cookie}`, `nextHop` keeps headers only when `target.origin === origin`, `sendHop`/`requestWithinOrigin` follow redirects themselves, and `const http: HttpClient = { request: requestWithinOrigin }` is the module's only transport binding. `git diff 9de84814..HEAD -- platform/git.ts` shows NO edit to `sendHop`/`nextHop`/`requestWithinOrigin`/`CROSS_ORIGIN_HEADERS`/the `http` binding — only the auth option type (now `BuildAuthCallbacksOpts`) and `listRemotes`. Tests pass: `git-auth-callbacks.test.ts` "cancels for a url on another host without querying the helper", "WR-01: cancels an http url on the bound host ...", "cancels a host mismatch before any interactive auth can start", the two port-mismatch cases, "matches a url carrying the default https port ...", "cancels and logs when the url cannot be parsed", "keeps a rejected credential and cancels for a stored-credential bundle"; `git.test.ts` "git-upload-pack POST redirect" cases (GAUTH-06 wire-level, GET and POST legs). Live corroboration: 01-UAT.md test 16 |
| 5 | `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` and the no-orchestrator-network gate; no new value import of `platform/git.ts` in `auth-host.ts` | ✓ VERIFIED | `npm run check` was NOT re-run per the task constraint; CI ran it green on `c1286475` (PR #221) and the branch tree equals `main` `a0d3aef1`. Independently confirmed here with a targeted run: `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` -> 668 tests, 668 pass, 0 fail (EXIT=0). `auth-host.ts` imports from `platform/` only `git-credential.ts` (value) and type-only from `git-auth-callbacks.ts`; the `GitAuthBundle` type is `Readonly<BuildAuthCallbacksOpts>` in `orchestrators/marketplace/shared.ts` (type-only edge). |

**Score:** 5/5 truths verified (0 present-behavior-unverified)

### Change inventory since the prior report's base (`9de84814`)

| Commit | Effect on phase 1 must-haves |
|--------|------------------------------|
| `505dc912` style(auth-host): `String.raw` for the credential remedy | Formatting of `NO_STORED_CREDENTIAL_CAUSE`; the rendered remedy string is asserted verbatim in `update.test.ts` (Truth 2) |
| `23cc2218` style: TS style / unit-testing review fixes | Test/comment rewrites; the surviving tests re-run green |
| `ae8ce217` refactor(git): one shared auth option type | `GitAuthBundle` = `Readonly<BuildAuthCallbacksOpts>`; `platform/git.ts` option types now reference it (Truth 1, 4) |
| `62ec0fa6` docs(git): describe the shared auth type | Doc only |
| `c1286475` fix: fold the GitHub host case, settle review findings | `kind` discriminant, builder split, `update.ts` keys on `auth.kind`, auth now required by `materializePluginClone`/`materializeOrRefreshPluginMirror` (Truths 1, 3, 4) |
| `1cc96c97` / `add75890` (already reviewed in the prior report) | `domain/source.ts` url/raw identity check; `listRemotes` multi-url refusal — outside every must-have |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | bundle for every host; `kind` discriminant; `buildAuthForHost` / `buildCloneAuth` / `buildStoredCredentialAuth`; `NO_STORED_CREDENTIAL_CAUSE` | ✓ VERIFIED | Read in full; substantive, wired (add/update/install/reinstall/fetch/info/update-preflight) |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | discriminated `BuildAuthCallbacksOpts`; `onAuth` scheme+host compare before fill; stored-credential skips eviction | ✓ VERIFIED | Read in full; wired via `git.ts` at three call sites |
| `extensions/pi-claude-marketplace/platform/git.ts` | origin-scoped redirect-following `HttpClient`; optional `auth?: BuildAuthCallbacksOpts` on clone/fetch/resolveRemoteRef | ✓ VERIFIED | GAUTH-06 surface unchanged since `9de84814`; auth option types re-pointed to the shared type |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | cause line keyed on `auth.kind === "stored-credential"` | ✓ VERIFIED | `refreshUrlClone` lines ~393-411; tested |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | `buildAuthForHost` on github and url arms | ✓ VERIFIED | lines ~875, ~919 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` | `auth: GitAuthBundle` required on the two materializers | ✓ VERIFIED | All callers (install/reinstall/fetch/info/update-preflight) pass a bundle; the pinned arms' `resolvePluginPin` calls carry no auth only when `source.sha` is set, where it performs no network I/O |
| `tests/platform/git.test.ts`, `git-auth-callbacks.test.ts`, `tests/orchestrators/auth-host.test.ts`, `marketplace/update.test.ts` | discriminating proofs for Truths 1-4 | ✓ VERIFIED | Assertions are whole-value `deepStrictEqual` on the bundle and on the exact notification text; the SC3 case fails if a cause line is attached |
| `.planning/workstreams/git-hosts/REQUIREMENTS.md` / `ROADMAP.md` | GAUTH-03..06 `[x]` / `Complete`; Phase 1 SC restated | ✓ VERIFIED | Unchanged |
| `01-UAT.md` / `01-SECURITY.md` | 16/16 human tests pass; `threats_open: 0` | ✓ VERIFIED | Unchanged; independent corroboration only |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `add.ts` / `update.ts` | `auth-host.ts::buildAuthForHost` | direct call per source arm | ✓ WIRED | github arm binds `GITHUB_HOST`; url arm binds `hostFromCloneUrl(source.url, "url")` |
| plugin install/reinstall/fetch/info/update probes | `auth-host.ts::buildCloneAuth` | direct call | ✓ WIRED | autoupdate (no ctx) uses `buildStoredCredentialAuth` |
| `platform/git.ts::clone/fetch/resolveRemoteRef` | `buildAuthCallbacks` | `opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth)` | ✓ WIRED | lines 267, 284, 345 |
| `update.ts::refreshUrlClone` | `NO_STORED_CREDENTIAL_CAUSE` | `auth.kind === "stored-credential"` guard | ✓ WIRED | replaces the retired `hasDeviceFlowProvider` |
| `git.ts::clone/fetch/listServerRefs` | `requestWithinOrigin` | module-private `http: HttpClient` | ✓ WIRED | unchanged |
| `sendHop` -> `nextHop` | cross-origin header scrub | `target.origin === origin ? headers : withoutHeaders(headers, CROSS_ORIGIN_HEADERS)` | ✓ WIRED | unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `onAuth` return value | `filled` credential | `credentialOps.fill(opts.host)` (real `git credential fill` via `DEFAULT_CREDENTIAL_OPS`) | Yes | ✓ FLOWING |
| `update.ts` cause line | `host` in `NO_STORED_CREDENTIAL_CAUSE(host)` | `hostFromCloneUrl(source.url, "url")` | Yes | ✓ FLOWING |
| `git.ts::sendHop` wire log | per-hop `Authorization` header | wire-transport double, GET and POST legs | Yes — unchanged | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 1 surface plus its callers, targeted | `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/marketplace/add.test.ts tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` | 668/668 pass, 0 fail | ✓ PASS |
| Retired symbols absent | `grep -rn "hasDeviceFlowProvider\|evictOnFailure\|NO_PROVIDER_CAUSE" extensions tests` | no matches | ✓ PASS |
| Redirect guard untouched | `git diff 9de84814..HEAD -- extensions/pi-claude-marketplace/platform/git.ts \| grep "sendHop\|nextHop\|requestWithinOrigin\|CROSS_ORIGIN"` | no diff lines | ✓ PASS |
| Full `npm run check` | not re-run (task constraint) | CI green on `c1286475` (PR #221); branch tree == `main` `a0d3aef1` | ✓ PASS (cited) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` exists; none declared by any PLAN/SUMMARY | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GAUTH-03 | 01-01, 01-03 | Clone a private source on any git host from a stored credential, no host-specific code, no registry literal | ✓ SATISFIED | Truth 1 |
| GAUTH-04 | 01-01 | No-stored-credential miss fails with a cause line naming `git credential approve` | ✓ SATISFIED on `update` | Truth 2; add/install deferred to Phase 3 SC5 (recorded, unchanged) |
| GAUTH-05 | 01-01, 01-03 | `github.com` / `gitlab.com` keep today's Device Flow behavior; declined flow gets no stored-credential cause line | ✓ SATISFIED | Truth 3 — re-proved against the `auth.kind` keying |
| GAUTH-06 | 01-01, 01-02, 01-04 | A credential resolved for one host is never offered to another, including across a redirect, on every leg | ✓ SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly GAUTH-03..06 to Phase 1; all four appear in
the plans' `requirements:` fields and are `[x]` / `Complete`.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | None | — | — |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`) in phase-touched production files | none | No unreferenced markers introduced |

### Code Review Disposition (01-REVIEW.md / 01-REVIEW-DISPOSITION.md)

WR-01, WR-03, WR-04 (warning) and IN-01..05 (info) remain recorded `open` and are carried by
BACKLOG entry GHRED-01. None describes a credential disclosure, and none falsifies a must-have
after the `c1286475` refactor.

### Human Verification Required

None. All 5 truths are proven by automated tests re-run this round; `01-UAT.md`'s 16/16 pass is
independent corroboration and the sole proof for no must-have.

### Gaps Summary

None. All 5 ROADMAP success criteria for Phase 1 hold against the current code. The `c1286475`
refactor replaced `evictOnFailure` and `hasDeviceFlowProvider` with the `kind` discriminant; the
stored-credential cause line is still attached only for `stored-credential` bundles (a declined
Device Flow on `github.com`/`gitlab.com` stays a bare `{authentication required}`), the origin
host compare and the redirect guard still bound every credential disclosure path, and every caller
of the two now-auth-requiring materializers passes a bundle.

---

_Verified: 2026-09-30T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 01-VERIFICATION.md (passed, 5/5, 2026-09-28T22:50:00Z) — stale after
`505dc912`, `23cc2218`, `ae8ce217`, `62ec0fa6`, `c1286475`; no regression._
