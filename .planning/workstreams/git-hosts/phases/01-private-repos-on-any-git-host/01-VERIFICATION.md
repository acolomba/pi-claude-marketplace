---
phase: 01-private-repos-on-any-git-host
verified: 2026-09-28T22:50:00Z
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
covered_digest: "v2:sha256:7ddb6ca42cbc64964d87ee002efc3e390e2b08b134e7583d24231f5c392f2f46"
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

> **Re-verification, triggered by staleness only.** The prior report (`passed`, 5/5, dated
> 2026-09-28T16:30:00Z, committed at `9de84814`) went `stale` because a covered file
> (`extensions/pi-claude-marketplace/platform/git.ts`) changed afterward. Quick task
> `260928-tt9` landed two production commits after `9de84814`:
> `1cc96c97` (`domain/source.ts` — a url object source's `raw` must now name the same
> repository as its `url`, T-2-10) and `add75890` (`platform/git.ts::listRemotes` now reads
> every `remote.origin.url` value and reports `origin` only for exactly one, WR-11/T-3-05),
> plus one doc-only commit (`2ffb5fcb`) and one further doc-only commit affecting phases 2/3
> only (`0aeb92d2`, not phase 1). Neither production commit touches the credential/redirect
> surface phase 1's must-haves depend on: `1cc96c97` is entirely inside `domain/source.ts`
> (a layer phase 1's must-haves do not cover), and `add75890`'s only production edit is
> `listRemotes`, a clone-reuse-detection function separate from `sendHop`/`nextHop`/
> `requestWithinOrigin`/the module-private `HttpClient` (the redirect-following, origin-scoped
> transport `GAUTH-06` depends on) and from `buildAuthCallbacks`/`onAuth` (`GAUTH-06`'s
> caller-side guard). This report re-verifies from scratch rather than assume the prior
> narrative, and confirms no regression.

# Phase 1: Private repos on any git host — Verification Report (re-verification)

**Phase Goal:** A Pi user can clone a private marketplace or plugin source over https from any git
host using a credential already in their git credential helper — no hostname is added to any
registry for it to work — and that credential is never offered to a host other than the one it was
resolved for.

**Verified:** 2026-09-28T22:50:00Z
**Status:** passed
**Re-verification:** Yes — staleness only (a covered file changed, but the change is confined to a
function outside the scope of every must-have; no regression found)

## Goal Achievement

ROADMAP Success Criteria are the contract (`.planning/workstreams/git-hosts/ROADMAP.md`, Phase 1,
5 criteria). Scope determined via `git diff --stat 9de84814..HEAD -- extensions/ tests/ scripts/`
(see full change inventory below) and a direct read of every changed line inside the two files
that intersect phase 1's covered-file set.

### Change inventory since the prior `passed` report (commit `9de84814`)

| Commit | Files | In phase 1 scope? | Effect |
|--------|-------|--------------------|--------|
| `1cc96c97` fix(source): require a url source's raw to name its url's repository | `domain/source.ts` (+13), `tests/domain/source.test.ts` (+50) | No — `domain/source.ts` is not a phase 1 covered file and no phase 1 truth depends on url/raw identity matching (that's T-2-10, a Phase 2/url-source concern) | None |
| `add75890` fix(git): refuse a leftover origin that records more than one url | `platform/git.ts` (`listRemotes` only, ~30 net lines), `tests/orchestrators/marketplace/add.test.ts`, `tests/platform/git.test.ts` (`listRemotes` test block) | Partially — `platform/git.ts` IS a phase 1 covered file, but the edited function (`listRemotes`) is outside every phase 1 must-have's scope (see below) | None on phase 1 truths; confirmed by direct read |
| `2ffb5fcb` docs(quick-260928-tt9) | `.planning/quick-tasks.jsonl`-family docs only | No | None |
| `0aeb92d2` docs(02,03): add security threat verification | `02-SECURITY.md`, `03-SECURITY.md` | No — phases 2/3, not phase 1 | None |

**Why `listRemotes` is out of scope for phase 1's must-haves:** phase 1's 5 success criteria are
about (a) reaching `credentialOps.fill(host)` for any host, (b) the no-stored-credential cause
line, (c) `github.com`/`gitlab.com` Device Flow parity, (d) the credential never crossing an
origin boundary (caller-side `onAuth` host compare + the redirect-following transport), and (e)
`npm run check` green with the credential-leak/no-orchestrator-network gates. `listRemotes` reads
an existing clone's recorded `origin` remote to decide whether a cached clone is stale
(`orchestrators/marketplace/add.ts`'s clone-reuse check) — it never touches an HTTP request, never
carries a credential, and is not called from `install-clone-probe.ts`/`reinstall-clone-probe.ts`
(confirmed by `grep -rn "listRemotes" extensions/` — the only production call site is
`orchestrators/marketplace/add.ts:722`, via the `GitOps` interface in
`orchestrators/marketplace/shared.ts`). A direct read of the current `platform/git.ts` (lines
1–345) confirms `sendHop`, `nextHop`, `requestWithinOrigin`, `withoutHeaders`,
`CROSS_ORIGIN_HEADERS`, and the module-private `http: HttpClient` binding — the whole GAUTH-06
redirect guard — are byte-identical to the prior verification; only the `listRemotes` function
body and its docstring changed.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With a PAT stored in their helper, a user can `marketplace add` / `plugin install` a private https source on a host the registry does not claim, and the clone succeeds | ✓ VERIFIED | Carried forward — no code in scope for this truth changed. `node --test tests/orchestrators/auth-host.test.ts` re-run green (part of the combined run below). Live evidence: 01-UAT.md test 2 |
| 2 | When nothing is stored for such a host, the command fails with a cause line naming `git credential approve` (scoped to `update`, per the 2026-07-11 checkpoint deferred to Phase 3 SC5) | ✓ VERIFIED | Carried forward — no code in scope changed. Live evidence: 01-UAT.md test 3 |
| 3 | `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same memoization, no stored-credential cause line on a declined flow | ✓ VERIFIED | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError" extensions/ tests/` — no matches (retired, unchanged). Domain/auth-registry untouched since prior verification |
| 4 | A credential resolved for one host is never sent to another: the caller-side `onAuth` host compare holds, AND a same-origin-only rule holds across redirects — no `Authorization` reaches a hop whose `URL.origin` differs from the original request's, on any request the operation sends (GET discovery leg AND the credential-bearing POST leg) | ✓ VERIFIED | Direct read confirms `sendHop`/`nextHop`/`requestWithinOrigin`/`http` binding unchanged since `9de84814`. Re-run: `node --test --test-name-pattern="git-upload-pack POST redirect" tests/platform/git.test.ts` → 5/5 pass. `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts tests/architecture/no-credential-leak.test.ts` → 114/114 pass |
| 5 | `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` and the no-orchestrator-network gate; no new export from `platform/git.ts`; no coverage-direct pin; no new type-member contract | ✓ VERIFIED | Executor's log (`/tmp/.../scratchpad/check.log`) at HEAD `add75890` (code-identical to current HEAD `0aeb92d2` — `git diff --stat add75890..HEAD -- extensions tests scripts package.json` is empty, confirmed) shows `CHECK_EXIT=0`; unit `7396/7396` pass (10 more than the prior report's 7386, matching exactly the new tests added by `1cc96c97`+`add75890`); integration `36/36` pass; coverage `git.ts` / `auth-host.ts` / `git-auth-callbacks.ts` all `100.00/100.00/100.00`; `lint:type-members` 4 pre-existing exceptions unchanged, negative controls 7/7 pass |

**Score:** 5/5 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts` | module-private redirect-following `HttpClient`, origin-scoped header scrub | ✓ VERIFIED | The GAUTH-06 surface (`sendHop`/`nextHop`/`requestWithinOrigin`/`http`) is byte-identical to the prior verification; only `listRemotes` (an unrelated clone-reuse-detection function) changed in this file. 100% direct coverage confirmed in the fresh coverage table |
| `tests/platform/git.test.ts` | wire-level double reproducing the leak, proving the fix, for both GET and POST legs | ✓ VERIFIED | 5 named GAUTH-06 POST-redirect tests still pass; the file's other diff since `9de84814` is a new `listRemotes` describe block (6 new cases: no-keys origin, empty-url origin, foreign-first-of-two, foreign-second-of-two, two-origin-sections, capitalized-section-name) — additive test coverage for the WR-11 fix, does not touch or weaken the GAUTH-06 assertions |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | Unchanged since `9de84814` (fallow's hotspot-churn listing shows commit/fan-in metadata drift only, not a source diff — confirmed no diff via `git diff --stat`) |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | docstring no longer credits `simple-get` | ✓ VERIFIED | Unchanged since `9de84814` |
| `.planning/workstreams/git-hosts/REQUIREMENTS.md` | GAUTH-06 amendment paragraph, GAUTH-03..06 marked complete | ✓ VERIFIED | Unchanged; all four still `[x]` and `Complete` in the coverage table |
| `.planning/workstreams/git-hosts/ROADMAP.md` | Phase 1 SC4 restated (origin-scoped transport guard) | ✓ VERIFIED | Unchanged; wording re-read and confirmed to match the current `platform/git.ts` behavior |
| `.planning/workstreams/git-hosts/phases/.../01-UAT.md` | 16/16 human tests pass, gap G-01-4 resolved | ✓ VERIFIED | `total: 16 / passed: 16 / issues: 0`, unchanged |
| `.planning/workstreams/git-hosts/phases/.../01-SECURITY.md` | threat register, threats_open = 0 | ✓ VERIFIED | `threats_open: 0`, unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/git.ts::clone/fetch/listServerRefs` | `platform/git.ts::requestWithinOrigin` | the module-private `http: HttpClient` binding | ✓ WIRED | Unchanged; direct read of lines 269 (`const http: HttpClient = { request: requestWithinOrigin }`) and its three call sites confirms no diff |
| `sendHop` → `nextHop` | cross-origin header scrub | `target.origin === origin ? headers : withoutHeaders(headers, CROSS_ORIGIN_HEADERS)` | ✓ WIRED | Unchanged; still proven by the 5 named POST-redirect tests, re-run green this round |
| `update.ts` cause attachment | `NO_STORED_CREDENTIAL_CAUSE` / `hasDeviceFlowProvider` | `err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(host))` guarded by `!hasDeviceFlowProvider(host)` | ✓ WIRED | Unchanged; `orchestrators/marketplace/update.ts` not touched by either new commit |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `git.ts::sendHop` wire log | recorded `Authorization` header per hop, GET/discovery leg | `installWireTransport`'s `https.request`/`nodeHttp.request` mock | Yes — unchanged | ✓ FLOWING |
| `git.ts::sendHop` wire log | recorded `Authorization` header per hop, credential-bearing `git-upload-pack` POST leg | Same wire-transport mock, driven through `authenticatedPostRedirectServer` | Yes — unchanged, re-run green | ✓ FLOWING |
| Live-server `Authorization` header log | per-request auth state on an instrumented HTTPS/HTTP server | operator-run harness (`01-UAT.md` test 16) | Yes — real socket traffic, human-observed, unchanged | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Named POST-redirect GAUTH-06 tests pass | `node --test --test-name-pattern="git-upload-pack POST redirect" tests/platform/git.test.ts` | 5/5 pass | ✓ PASS |
| Combined phase 1 suites | `node --test tests/platform/git.test.ts tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts tests/architecture/no-credential-leak.test.ts` | 114/114 pass, 13 suites | ✓ PASS |
| Redirect-guard source unchanged (code read, not inferred) | `sed -n '1,269p' extensions/pi-claude-marketplace/platform/git.ts` | `sendHop`/`nextHop`/`requestWithinOrigin`/`http` binding byte-identical to prior verification | ✓ PASS |
| No production diff between the executor's check-log HEAD and current HEAD | `git diff --stat add75890..HEAD -- extensions tests scripts package.json` | empty | ✓ PASS |
| Full production diff since the prior `passed` report, scoped | `git diff --stat 9de84814..HEAD -- extensions/ tests/ scripts/` | `domain/source.ts` (+13), `platform/git.ts` (`listRemotes` only), plus corresponding test files | ✓ PASS (reviewed in full above, confirmed out of phase 1 scope except the confirmed-unaffected `listRemotes` edit) |
| Full `npm run check` (executor's log, cited not re-run per instructions) | `check.log`: `npm run check > check2.log 2>&1; echo CHECK_EXIT=$?` | `CHECK_EXIT=0`; unit 7396/7396, integration 36/36, coverage 100.00/100.00/100.00 for `git.ts`/`auth-host.ts`/`git-auth-callbacks.ts` | ✓ PASS |
| Debt markers on changed phase 1 file | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" extensions/pi-claude-marketplace/platform/git.ts extensions/pi-claude-marketplace/domain/source.ts` | no matches | ✓ PASS |

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
| GAUTH-06 | 01-01, 01-02, 01-04 | A credential resolved for one host is never offered to another, including across a redirect, on every leg of the request | ✓ SATISFIED | Truth 4 — GET leg and POST leg both automated; UAT test 16 is independent corroboration |

No orphaned requirements: REQUIREMENTS.md maps exactly GAUTH-03..06 to Phase 1, and all four appear
in the plans' `requirements:` fields. All four are marked `[x]` in REQUIREMENTS.md and `Complete`
in its coverage table (unchanged since prior verification).

### Advisory (New Scope, Unevidenced)

Step 7 anti-pattern scan (debt markers, stub patterns, hollow props) over the two production files
touched since the prior report (`domain/source.ts`, `platform/git.ts`) produced zero new 🛑 Blocker
findings.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | — | — | None |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` in the two files changed since the prior report | none | Zero matches |

### Code Review Disposition (01-REVIEW.md / 01-REVIEW-DISPOSITION.md)

Unchanged since the prior verification (this pass edits only `01-VERIFICATION.md`). WR-01, WR-03,
WR-04 (warning) and IN-01..05 (info) remain recorded `open`, none describing a credential
disclosure and none affected by the `listRemotes`/`domain/source.ts` changes reviewed above.
WR-02's disposition entry was already noted stale (closed by `a2db444e`, prior to this round) —
unaffected by this round's changes.

### Human Verification Required

None. All 5 truths remain automated-test-verified; the two production commits landing since the
prior `passed` report do not touch the credential-redirect surface any must-have depends on.
`01-UAT.md`'s 16/16 pass remains as independent corroborating evidence, not the sole proof for any
must-have.

### Gaps Summary

None. All 5 ROADMAP success criteria for Phase 1 remain verified: no truth failed, no artifact is
missing or a stub, every key link is wired, and the executor's fresh `npm run check` run (cited,
not re-run per instructions — two sibling verifiers running in parallel) is green with `CHECK_EXIT=0`
at a commit code-identical to current HEAD. The prior report went stale purely because
`platform/git.ts` — a covered file — changed; a full read of that change (`listRemotes`, WR-11)
confirms it is confined to a clone-reuse-detection function entirely outside the scope of every
phase 1 must-have, and the GAUTH-06 redirect-guard surface (`sendHop`/`nextHop`/
`requestWithinOrigin`/`http`) is byte-identical to the version already verified. No regression
found.

---

_Verified: 2026-09-28T22:50:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 01-VERIFICATION.md (passed, 5/5, 2026-09-28T16:30:00Z, committed 9de84814) —
went stale due to a covered-file change (`platform/git.ts::listRemotes`, commit `add75890`,
WR-11/T-3-05) confirmed out of scope for every phase 1 must-have; a second production commit
(`1cc96c97`, `domain/source.ts`, T-2-10) is outside the covered-file set entirely._
