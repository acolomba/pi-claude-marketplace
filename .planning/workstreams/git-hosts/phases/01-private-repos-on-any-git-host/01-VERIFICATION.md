---
phase: 01-private-repos-on-any-git-host
verified: 2026-09-26T05:04:51Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/workstreams/git-hosts/REQUIREMENTS.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-01-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-01-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-02-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-02-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-03-PLAN.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-03-SUMMARY.md
  - .planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-CONTEXT.md
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
covered_digest: "v1:sha256:bf07630f84cf263732c49d782f216e49ff074a421a2648ede865a613e8181260"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "SC2 — `marketplace add` / `plugin install` surface the stored-credential cause line naming `git credential approve`"
    addressed_in: "Phase 3"
    evidence: "ROADMAP Phase 3 SC5: 'Its OUTCOME still holds — `add` and `install` show a bare `(failed) {authentication required}` row and only `update` carries a cause line, which is a recorded user checkpoint (2026-07-11) this milestone does not revisit.'"
human_verification:
  - test: "Live canary — resolve a credential for a non-registry host through the REAL `git credential` subprocess, then clone a real private repo on that host. Exact commands in the Human Verification Required section below."
    expected: "`DEFAULT_CREDENTIAL_OPS.fill(<your host>)` returns the stored credential (and `null` for a host you did not store), and `marketplace add https://<your-host>/<owner>/<private-repo>` renders `● <name> [project] (added)`."
    why_human: "Every phase test fakes `CredentialOps` at the memory boundary, and `tests/platform/git-credential.test.ts` fakes the subprocess. No offline test ever runs the real `git credential fill` against a real helper, and this machine currently has NO `credential.helper` configured at any scope (`git config --system/--global/--local --get-all credential.helper` all return nothing), so the operator must configure one and supply a real private remote. The only remaining unproven link in the chain is helper-subprocess -> real remote."
---

> **Amended 2026-09-26, after the review fixes.** Every verdict below still holds, but two kinds of
> detail in the evidence column are now as-of commit `3adb12c4` rather than current:
>
> - The cause line is quoted as `no credential stored for <host>; add one with git credential
>   approve`. Review finding WR-03 widened it to `no credential was obtained for <host>; store one
>   with: printf 'protocol=https\nhost=<host>\nusername=<user>\npassword=<token>\n\n' | git
>   credential approve` — the old text asserted a specific cause for five outcomes that
>   `credentialFill` collapses to `null`, and the old remedy was not executable as written.
> - `update.ts` line numbers shifted. Cited ranges are pre-fix.
>
> Also landed after this report: CR-01 (`onAuthFailure` now evicts only where a Device Flow can
> re-mint — `evictOnFailure` on the bundle) and WR-01 (`onAuth` requires `https:`). Neither changes
> a verdict here; both narrow behavior the report described as unconditional.


# Phase 1: Private repos on any git host — Verification Report

**Phase Goal:** A Pi user can clone a private marketplace or plugin source over https from any git
host using a credential already in their git credential helper — no hostname is added to any
registry for it to work — and that credential is never offered to a host other than the one it was
resolved for.

**Verified:** 2026-09-26T05:04:51Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Verified at:** `3adb12c4` (phase span `f4f98c66..3adb12c4`; working tree carries no code changes)

## Goal Achievement

### Observable Truths

ROADMAP Success Criteria are the contract. No PLAN carried a `must_haves:` frontmatter block, so
these five are the roadmap's own SC verbatim.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With a PAT stored in their helper, a user can `marketplace add` / `plugin install` a private https source on a host the registry does not claim, and the clone succeeds — `credentialOps.fill(host)` is reached because `buildAuthForHost` returns a bundle for every host, and no hostname literal was added to `domain/auth-registry.ts` | ✓ VERIFIED | `orchestrators/auth-host.ts:133-175` — return type is `GitAuthBundle` (non-nullable); both arms `return { credentialOps, host, onAuthRequired }`; no `return undefined` remains. `git-auth-callbacks.ts:164` calls `opts.credentialOps.fill(opts.host)`. `tests/orchestrators/auth-host.test.ts:125` proves the fill is reached for `git.example.invalid` and returns the stored credential (`fill: [{host:"git.example.invalid"}]`). `auth-registry.ts` is NOT in the phase diff — grep finds only `github.com` and `gitlab.com` as host values (`evil-gitlab.com` at line 69 is docstring prose, not a `hostMatch` literal). Bundle byte-locked at `marketplace add` (`tests/orchestrators/marketplace/add.test.ts:2341`, host `gitlab.example.com`), `plugin install` (`tests/orchestrators/plugin/install-flow.test.ts:7136`, `authHost: "gitlab.example.com"`), every plugin probe, and both edge handler suites. Transport proof through real isomorphic-git: `tests/platform/git.test.ts` "retries an authentication challenge with the exact credential header" resolves `OID_MAIN` on `git.example.invalid` (non-registry) carrying `Authorization: Basic dXNlcjpzZWNyZXQ=` |
| 2 | When nothing is stored for such a host, the command fails with a cause line naming `git credential approve`, instead of cloning authless and surfacing a bare structural 401 | ✓ VERIFIED (scoped to `update`) | `update.ts:401-411` — the guard is `err instanceof Error && err.cause === undefined && classifyGitTransportFailure(err) === "authentication required" && !hasDeviceFlowProvider(host)`. `shared/git-failure-classifiers.ts:81-83` classifies `UserCanceledError` as `authentication required`, so the cause line lands on the failure identity a `{cancel:true}` actually produces — the exact hazard 01-CONTEXT.md flagged. Proven on BOTH identities: `tests/orchestrators/marketplace/update.test.ts:720` (UserCanceledError) and `:772` (HttpError 401) both assert `/cause:.*no credential stored for gitlab\.example\.com; add one with git credential approve/`; `:815` asserts an error that already carries a cause keeps its own chain. The "no longer clones authless" half holds on every surface (`add.ts:694,800,844` now pass `auth` unconditionally). The add/install cause-line asymmetry is `deferred` — see below |
| 3 | `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same memoization | ✓ VERIFIED (third clause superseded) | `domain/auth-registry.ts` and `domain/github-auth.ts` are NOT in the phase diff — zero-diff on the descriptors and the Device Flow engine. `auth-host.ts:155-172` keeps the memo-then-flow order unchanged. Memoization proven: `tests/orchestrators/auth-host.test.ts:431` "returns the same-host memo entry without repeating authentication" and `:517` "isolates memo entries and provider arguments across different hosts". GAUTH-05 negative assertion found at `tests/orchestrators/marketplace/update.test.ts:850` — a cancelled Device Flow on a `github.com` url refresh asserts `first.message.includes("no credential stored for") === false`, which is precisely the regression `hasDeviceFlowProvider` prevents. SC3's third clause (`NO_PROVIDER_CAUSE` still surfaces) is superseded by D-1-04 and by the recorded GAUTH-05 amendment — see Findings W1 |
| 4 | A credential resolved for one host is never sent to another: `onAuth` cancels on a host mismatch, making the previously-ignored `url` parameter load-bearing; the guard is exercised directly; PROV-04 / T-79-04 is restated rather than deleted | ✓ VERIFIED | `git-auth-callbacks.ts:153-162` — `new URL(url).host` is compared to `opts.host` and returns `{cancel:true}` BEFORE the `fill` on line 164. Ordering is proven by call-count, not end-state: `tests/platform/git-auth-callbacks.test.ts:170` asserts `credentials.calls === {fill:[],approve:[],reject:[]}` on a mismatch, so the helper is never queried. Five direct cases (foreign host, before-interactive-auth, port-bearing bound host, port-bearing url host, `:443` normalizes to a match, unparseable url). Transport proof: `tests/platform/git.test.ts` "cancels a challenge from a url on another host without querying the helper" runs real isomorphic-git and asserts `requestsCarryingAuthorization(requests) === []`. PROV-04 / T-79-04 restated in the docstrings at `git-auth-callbacks.ts:86-99` and `auth-host.ts:123-131`, not deleted |
| 5 | `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` and the no-orchestrator-network gate (`auth-host.ts` gains no value import of `platform/git.ts`) | ✓ VERIFIED | Both NAMED gates re-run by this verifier at HEAD `3adb12c4`: 12 tests, 12 pass, exit 0. `auth-host.ts` imports `platform/git.ts` not at all, and `platform/git-auth-callbacks.ts` only via `import type` (line 39). `git-auth-callbacks.ts` IS registered in `CREDENTIAL_LEAK_TARGETS` (`tests/architecture/gate-targets.ts:418`), so AUTH-09 actually covers the new debug line. Independently re-run green: `typecheck`, `lint`, `format:check`, `fallow` (exit 0 — the ✗ dupes glyph is cosmetic), `lint:type-members`, `test:corresponding`, `test:coverage:direct`. See Gate Re-Runs table |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SC2's cause line on the `marketplace add` / `plugin install` surfaces (both render the bare `(failed) {authentication required}` row; only `update` carries the cause line) | Phase 3 | ROADMAP Phase 3 SC5: "Its OUTCOME still holds — `add` and `install` show a bare `(failed) {authentication required}` row and only `update` carries a cause line, which is a recorded user checkpoint (2026-07-11) this milestone does not revisit." Phase 3 SC5 also owns the PROJECT.md D-79-03 rationale rewrite. The behavior is deliberate and test-locked: `tests/orchestrators/marketplace/add.test.ts:2729` asserts the add row does NOT contain `NO_STORED_CREDENTIAL_CAUSE(...)`, importing the live constant so the assertion cannot outlive the text |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | `buildAuthForHost` returns a bundle on every path; `NO_STORED_CREDENTIAL_CAUSE`; `hasDeviceFlowProvider` | ✓ VERIFIED | 211 lines. Non-nullable `GitAuthBundle` return; both arms return a literal. All three new/changed exports read by production (`update.ts`, `add.ts`, `update-preflight.ts`, six plugin call sites via `buildCloneAuth`) |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | `onAuth` compares host before `fill` | ✓ VERIFIED | Compare at 153-162, `fill` at 164. `_url` on `onAuthFailure` deliberately retained with a recorded rationale (the credential is already disclosed by then) |
| `extensions/pi-claude-marketplace/domain/auth-registry.ts` | NO new hostname literal | ✓ VERIFIED | Not in the phase diff at all. Only `github.com` / `gitlab.com` host values |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | cause guard includes `hasDeviceFlowProvider`; `isAuthChallengeError` removed | ✓ VERIFIED | Guard at 401-411 carries the `!hasDeviceFlowProvider(host)` term. `isAuthChallengeError` deleted (grep prints nothing repo-wide) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | `auth` no longer optional on the clone path | ✓ VERIFIED | `addGitClonedInGuard` takes `auth: GitAuthBundle` (was `auth?`); the always-true `...(auth !== undefined && {auth})` spreads dropped at 694, 800, 844 |
| Plugin surfaces (`clone-cache`, `fetch`, `info`, `install-clone-probe`, `install.messaging`, `reinstall-clone-probe`) | always-true auth spreads dropped; docstrings restated | ✓ VERIFIED | Six files, all spreads replaced by an unconditional `auth`. `install.messaging.ts` docstring corrected to name `UserCanceledError` as the empty-helper identity |
| `NO_PROVIDER_CAUSE` (retired) | absent | ✓ VERIFIED | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError" extensions/ tests/` → exit 1, zero output |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `orchestrators/auth-host.ts::buildAuthForHost` | `platform/git-auth-callbacks.ts::buildAuthCallbacks` | the `GitAuthBundle` threaded through `platform/git.ts` clone/fetch/resolveRemoteRef | ✓ WIRED | `platform/git.ts:139,156,217` — `opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth)`. The `auth?` optionality survives on the platform seam only for `plugin/update-preflight.ts::buildBundle`, which returns undefined with no `ctx` — see Finding I1 |
| `buildAuthCallbacks.onAuth` | `platform/git-credential.ts::credentialOps.fill` | direct call on a host match | ✓ WIRED | `git-auth-callbacks.ts:164`. Production `CredentialOps` = `DEFAULT_CREDENTIAL_OPS` = `createCredentialOps({spawn: NODE_CREDENTIAL_SPAWN, timeoutMs: 5000})` (`auth-host.ts:65-68`), the real `git credential` subprocess |
| `orchestrators/marketplace/update.ts` | `auth-host.ts::hasDeviceFlowProvider` + `NO_STORED_CREDENTIAL_CAUSE` | import + call in the catch guard | ✓ WIRED | Imports at 124-126, call sites at 408, 410 |
| `orchestrators/marketplace/add.ts` + six plugin call sites | `buildAuthForHost` / `buildCloneAuth` | direct call per source kind | ✓ WIRED | `add.ts:786,830`; `buildCloneAuth` called from `fetch.ts:387,398`, `install-clone-probe.ts:57`, `reinstall-clone-probe.ts:63`, `info.ts:1627,1640` |
| `shared/git-failure-classifiers.ts` | `UserCanceledError` → `authentication required` | the classifier ladder | ✓ WIRED | Lines 81-83. This is what makes the cause guard fire on the identity a `{cancel:true}` actually throws |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `git-auth-callbacks.ts::onAuth` | returned `GitCredentials` | `opts.credentialOps.fill(opts.host)` → `git credential fill` subprocess (`platform/git-credential.ts:199`, `protocol=https` + `host=`, no `path=`) | Yes at the seam; the subprocess itself is faked in every test | ⚠️ STATIC at the outermost boundary only — see Human Verification |
| `update.ts` cause line | `err.cause.message` | `NO_STORED_CREDENTIAL_CAUSE(host)`, host from `hostFromCloneUrl(source.url, kind)` | Yes — rendered into the real notification, asserted by regex on the emitted message | ✓ FLOWING |
| `git.ts` request headers | `Authorization` | isomorphic-git from the value `onAuth` returns | Yes — observed at the mocked `http.request` seam, exact base64 byte-locked | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No residual `NO_PROVIDER_CAUSE` / `isAuthChallengeError` | `grep -rn "NO_PROVIDER_CAUSE\|isAuthChallengeError" extensions/ tests/` | exit 1, no output | ✓ PASS |
| No third hostname literal in the registry | `grep -onE "[a-z0-9.-]+\.(com\|org\|net\|io\|dev\|sh)" .../domain/auth-registry.ts` | only `github.com`, `gitlab.com` (+ `evil-gitlab.com` in prose) | ✓ PASS |
| Host-mismatch cancel never queries the helper | `node --test tests/platform/git-auth-callbacks.test.ts tests/orchestrators/auth-host.test.ts` | 39 tests, 39 pass, exit 0 | ✓ PASS |
| Host-mismatch sends zero `Authorization` at the transport | `node --test tests/platform/git.test.ts` | 31 pass, exit 0; the four named auth cases green incl. "cancels a challenge from a url on another host without querying the helper" | ✓ PASS |
| Real `git credential fill` negative control | `node --input-type=module -e 'import {DEFAULT_CREDENTIAL_OPS} from "./extensions/pi-claude-marketplace/orchestrators/auth-host.ts"; console.log(await DEFAULT_CREDENTIAL_OPS.fill("gitlab.example.test"))'` | `null` — the real subprocess runs and misses cleanly | ✓ PASS (negative control only) |
| Real `git credential fill` positive control | same harness with a credential actually stored | not run — no `credential.helper` configured at any scope on this machine | ? SKIP → Human Verification |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` exists in this repository and no PLAN or SUMMARY declares a probe path | N/A |

### Gate Re-Runs (independent of the executor's claim)

Run by this verifier at HEAD `3adb12c4`. The three commits after the executor's gate run
(`d5762e0d`) touch only `.planning/` — confirmed by `git diff --stat d5762e0d..3adb12c4`.

| Gate | Exit | Note |
|------|------|------|
| `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts` | 0 | 12/12 pass — both criterion-5 named gates |
| `npm run typecheck` | 0 | |
| `npm run lint` | 0 | |
| `npm run format:check` | 0 | |
| `npm run fallow` | 0 | exit code read directly, not the ✗ dupes glyph |
| `npm run lint:type-members` | 0 | passed with 4 recorded exceptions, none introduced by this phase |
| `npm run test:corresponding` | 0 | |
| `npm run test:coverage:direct` | 0 | `platform/git.ts` branches 37/37, functions 9/9, lines 305/305 |
| `node --test tests/platform/{git,git-auth-callbacks}.test.ts tests/orchestrators/auth-host.test.ts` | 0 | 70 tests total |
| `npm run test:coverage:unit` (100% thresholds) | not re-run | Operator instruction: the full suite result is established (`npm test` exit 0, independently confirmed by the operator; executor recorded `CHECK_EXIT=0`, 7261/7261, `all files 100.00 \| 100.00 \| 100.00`) |
| `npm run test:integration` | not re-run | Same instruction |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GAUTH-03 | 01-01, 01-03 | Clone a private source on any git host from a stored credential, no host-specific code, no registry literal | ✓ SATISFIED | Truth 1 |
| GAUTH-04 | 01-01 | No-stored-credential miss fails with a cause line naming `git credential approve` | ✓ SATISFIED on `update` | Truth 2; add/install `deferred` to Phase 3 SC5 |
| GAUTH-05 | 01-01, 01-03 | `github.com` / `gitlab.com` keep today's Device Flow behavior byte-for-behavior | ✓ SATISFIED | Truth 3. Current (amended) text verified, not the pre-amendment text |
| GAUTH-06 | 01-02 | A credential resolved for one host is never offered to another | ✓ SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly GAUTH-03..06 to Phase 1, and all four appear
in the plans' `requirements:` fields.

### Decision Coverage

`gsd_run query check.decision-coverage-verify` returned `reason: could-not-parse` — 01-CONTEXT.md
writes decisions as `### D-1-01 — title` headings, which the parser's accepted forms do not cover.
Non-blocking; verified by hand instead:

| Decision | Honored | Evidence |
|----------|---------|----------|
| D-1-01 — `buildAuthForHost` always returns a bundle; registry gates only the Device Flow closure | ✓ | `auth-host.ts:133-175` |
| D-1-02 — the miss surfaces as an ERROR cause line, not a notify from `auth-host.ts` | ✓ | `auth-host.ts:144-152` raises no notification; `update.ts:410` attaches `err.cause` as the chain TAIL |
| D-1-03 — the host guard lives in `onAuth`, reason routed through `hookDebugLog` | ✓ | `git-auth-callbacks.ts:153-162` |
| D-1-04 — `NO_PROVIDER_CAUSE` retired, not kept alongside | ✓ | grep prints nothing; its test is gone; its one call site replaced |

4/4 honored.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` across all 29 changed files | none | Zero matches — no debt-marker gate trigger |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | none | Zero matches |
| — | — | skipped / `.todo` tests | none | Zero matches |
| `tests/orchestrators/plugin/install-flow.test.ts` | 2899-2908 | the word "placeholder" | ℹ️ Info | Pre-existing domain vocabulary (`CLAUDE_PLUGIN_ROOT` substitution), not a stub |

### Findings

**I1 — ℹ️ Info: the marketplace autoupdate cascade still clones authless on every host.**
`orchestrators/plugin/update-preflight.ts:160-163` — `buildBundle` returns `undefined` when
`auth.ctx === undefined`, and `orchestrators/plugin/update-flow.ts::updateSinglePluginWith`
(502-538), the `PluginUpdateFn` the marketplace autoupdate cascade invokes, never supplies a `ctx`.
So a private plugin source reached through `marketplace update` + autoupdate gets no auth bundle.
Not a Phase 1 regression and not host-specific: `update-preflight.ts` is untouched by this phase
(absent from the diff), the branch predates it, and it withholds auth from `github.com` identically.
It is also explicitly out of the 01-CONTEXT.md scope list. Recorded because the phase GOAL prose
("clone a private marketplace or plugin source ... from any git host") is broader than SC1's two
named verbs, and `auth-host.ts:190-192` documents the `update.ts` `buildBundle` exception without
naming this consequence. **Recommend filing it** rather than reopening Phase 1.

**W1 — ⚠️ Warning: ROADMAP SC3 still names the constant D-1-04 retired.** ROADMAP Phase 1 SC3 ends
"and `NO_PROVIDER_CAUSE` still surfaces wherever it still applies" — a symbol grep now proves absent
repo-wide. REQUIREMENTS.md GAUTH-05 was formally restated for exactly this reason (commit
`33771044`, with the amendment note in place), but the ROADMAP criterion was not restated alongside
it. The substantive guarantee is verified (Truth 3), so this is doc drift, not a code gap — but it
is the same "the next reader will infer a behavior that no longer exists" hazard that ROADMAP Phase 3
SC5 exists to fix for PROJECT.md. **Recommend restating SC3's third clause the way GAUTH-05 was
restated**, before Phase 2 planning reads it.

### Human Verification Required

One item. The three waves each recorded it as the same single runtime deliverable, and they were
right to: it is one unbroken gap and it is the last link in the chain.

#### 1. Live canary — real `git credential` helper, real private remote on a non-registry host

**Why this cannot be closed offline.** Every phase test injects `CredentialOps` through
`createCredentialOpsFake({boundary:"memory"})`, which hard-refuses any boundary other than `memory`
(`tests/platform/credential-ops-fake.ts:46`). The pre-existing `tests/platform/git-credential.test.ts`
fakes the subprocess. So the composition that actually ships —
`DEFAULT_CREDENTIAL_OPS = createCredentialOps({spawn: NODE_CREDENTIAL_SPAWN, timeoutMs: 5000})` —
has never been run against a real `credential.helper` for an arbitrary host by anything. This
verifier confirmed the negative control (no helper → `fill` returns `null`) and confirmed that this
machine has **no** `credential.helper` configured at any scope, so the positive control is not
merely untested, it is currently unconfigurable without operator action.

Everything else in the goal is already proven offline and needs no human: the bundle reaches every
verb, `fill` is reached with the correct host, the challenge→credential→`Authorization` header→
successful resolve path runs through real isomorphic-git on a non-registry host, and the
host-mismatch cancel sends zero `Authorization` headers (also through real isomorphic-git). **The
"no Authorization header crosses a host mismatch" half of the carried-forward item is closed — do
not re-test it by hand.**

**Criteria that rest on this:** SC1 only (and the phase goal's first clause). SC2-SC5 do not.

**Step A — the credential seam against a real helper (positive + negative control).**
Substitute your own host and PAT. The `GIT_CONFIG_*` form scopes the helper to one throwaway file
and mutates no committed config.

```bash
cd /home/acolomba/src/pi-claude-marketplace-pr-153

export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=credential.helper
export GIT_CONFIG_VALUE_0="store --file=/tmp/gauth-canary-credentials"

# store a PAT for YOUR non-registry host (self-hosted GitLab / Gitea / Forgejo / Bitbucket)
printf 'protocol=https\nhost=YOUR.HOST\nusername=YOUR_USER\npassword=YOUR_PAT\n\n' | git credential approve

node --input-type=module -e '
import { DEFAULT_CREDENTIAL_OPS } from "./extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
console.log("positive:", await DEFAULT_CREDENTIAL_OPS.fill("YOUR.HOST"));
console.log("negative:", await DEFAULT_CREDENTIAL_OPS.fill("not-stored.example.test"));
'
```

**Expected:** `positive: { username: "YOUR_USER", password: "YOUR_PAT" }` and `negative: null`.
A `null` positive means the real subprocess path does not reach your helper for a non-registry host
and SC1 fails at the outermost boundary.

**Step B — the whole verb, end to end.** `PI_CLAUDE_MARKETPLACE_DEBUG=1` surfaces the `[auth]`
lines, including the host-mismatch line if one fires.

```bash
cd /home/acolomba/src/pi-claude-marketplace-pr-153
CANARY=$(mktemp -d /tmp/gauth-canary-XXXX); mkdir -p "$CANARY/home" "$CANARY/project"

GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0=credential.helper \
GIT_CONFIG_VALUE_0="store --file=/tmp/gauth-canary-credentials" \
HOME="$CANARY/home" \
PI_CODING_AGENT_DIR="$CANARY/home/.pi/agent" \
PI_CODING_AGENT_SESSION_DIR="$CANARY/home/.pi/agent/sessions" \
PI_CLAUDE_MARKETPLACE_DEBUG=1 \
node node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js \
  --no-extensions \
  --extension extensions/pi-claude-marketplace/index.ts \
  --cwd "$CANARY/project" \
  -p '/claude:plugin marketplace add https://YOUR.HOST/OWNER/PRIVATE-REPO --scope project'
```

**Expected:** a `● <name> [project] (added)` row. If it renders
`⊘ <name> [project] (failed) {authentication required}`, the helper was reached but the credential
was refused — check the `[auth]` debug lines for `onAuth: url host ... does not match the bound
host ...`, which would mean the bound host and the cloned URL disagree (worth reporting: the port
participates in the compare by design, and `git credential fill` is host+port keyed the same way
git itself keys it).

**Step C — negative control for Step B.** Re-run Step B against the same private repo with the
helper removed (`unset GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0`). Expect
`⊘ ... (failed) {authentication required}` — a bare row on `add`, per the deferred item, not a
crash and not a silent success.

**Cleanup:** `rm -rf "$CANARY" /tmp/gauth-canary-credentials` and revoke the canary PAT.

### Gaps Summary

No gaps. Every one of the five ROADMAP Success Criteria is achieved in the code, and every
behavior-dependent claim in them — the cancellation ordering in `onAuth`, the memoization on a
registry host, the cause line arriving on the `UserCanceledError` identity rather than only on the
401 — is backed by a passing test that this verifier re-ran, not by a SUMMARY assertion. The two
hazards 01-CONTEXT.md predicted (a dead `auth === undefined` condition, and a cause line aimed at
the wrong error identity) are both actually closed: the guard was rewritten around
`classifyGitTransportFailure` and `hasDeviceFlowProvider`, and there is a `github.com` negative
assertion proving the GAUTH-05 regression cannot creep back in.

The phase is `human_needed` rather than `passed` for one reason, and it is not a lack of diligence
by the executor: the shipped `git credential` subprocess has never been run against a real
credential helper for a non-registry host, no offline test can do it, and this machine has no helper
configured. That is one command away from closed (Step A above), and the rest of the goal is already
proven.

Two items for the record, neither blocking: the marketplace autoupdate cascade still clones authless
on all hosts (pre-existing, out of scope, worth filing — I1), and ROADMAP SC3 still names the
retired `NO_PROVIDER_CAUSE` constant and should be restated the way GAUTH-05 was (W1).

---

_Verified: 2026-09-26T05:04:51Z_
_Verifier: Claude (gsd-verifier)_
