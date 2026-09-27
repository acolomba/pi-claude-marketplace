---
gsd_state_version: "1.0"
milestone: any-git-host
milestone_name: Any Git Host
current_phase: 2
current_phase_name: Endpoints that answer only at the verbatim URL
current_plan: 2
total_plans_in_phase: 3
status: Phase 2 plan 2 of 3 executed — plugin clone-cache seam threads the derived wire url
stopped_at: "Phase 2 plan 02 executed: materializePluginClone/materializeOrRefreshPluginMirror take a required networkUrl, resolvePluginPin derives it, all nine callers threaded, MURL-09 count-and-identity guard added (a909adaf, 80251086, bfe43963)"
last_updated: "2026-09-27T03:56:10.000Z"
last_activity: 2026-09-27
last_activity_desc: "Executed Phase 2 plan 02: plugin clone-cache seam threads networkUrl, 270 tests green across the six touched seam/owner suites, 100% direct coverage on all six touched files"
state_head: bfe43963
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

## Project Reference

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after
`/reload`, have every supported Claude plugin component appear as a working Pi-native artifact —
atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Current focus:** `any-git-host` reimplements the three real defects PR #153 (jstillwa) surfaced,
rather than merging that PR. A private source on any git host clones with a credential the user
already stored; an endpoint that answers only at its verbatim URL resolves; and `marketplace add`
recovers from its own leftover clone instead of demanding a manual `rm -rf`. The PR's two
Codex-layout changes are out of scope — Claude Code 2.1.274 contains zero references to
`.agents/plugins/` or `.codex-plugin/`.

## Current Position

Phase: 2 — Endpoints that answer only at the verbatim URL (plan 2 of 3 executed)
Current Plan: 2
Total Plans in Phase: 3
Status: Plans 01-02 (waves 1-2) executed; plan 03 (wave 3) remains, sequential by necessity
Last activity: 2026-09-27 — Executed Phase 2 Plan 02 (a909adaf, 80251086, bfe43963)

**Phase 2 is planned: three plans, three waves, sequential by necessity.** Plan 01 (wave 1) lands
`networkCloneUrl` and an extracted `stripSlashAndFragment` in `domain/`, wires the `marketplace add`
seam, and proves it end to end against a git port that admits only the verbatim URL. Plan 02 (wave 2)
threads a required `networkUrl` through the three `clone-cache.ts` seam sites and their nine callers.
Plan 03 (wave 3) discharges RESEARCH assumption A1 with a residual suite audit, fixes the docstrings
that still teach the retired rule, and owns the phase-boundary `npm run check`. The waves cannot run
in parallel: the required `networkUrl` field makes each seam edit atomic with its callers, and the
`contracts.json` pins are line:col, so ROADMAP already mandates one edit at a time.

**Mid-phase red is planned, not accidental.** After plan 02 task 1 the test tree does not typecheck —
30 literal-construction sites lack the new required field — and after plan 02 the flow, bootstrap,
reconcile, register, integration and `marketplace update` suites are red because their allowlists
still admit only the suffixed form. Both plans state this and forbid restoring a `.git` suffix to
reach green. Plan 03 closes it.

**Planning surfaced three gate exposures RESEARCH.md had missed**, all now planned: `fallow`
dead-code would have gone red had `networkCloneUrl` stripped `ensureGitSuffix` of its last production
consumer (the github arm is locked to `ensureGitSuffix(canonicalCloneUrl(source))`);
`addGitClonedInGuard`'s `cloneUrl` parameter becomes dead and is removed with both call-site passes;
and four `check-unused-type-members.contracts.json` coordinates shift under prettier and need an
in-place line remap. A fourth Wave 0 gap was recorded: five wire-URL sites are template literals and
were invisible to the `.git"` grep that sized RESEARCH's blast radius.

**Phase 2 turned out not to need the retry it was scoped around.** Research against the Claude Code
2.1.274 binary settled it: the marketplace source parser appends `.git` only for `github.com`
(`ho`/`Fs`) and `gitlab.com` (`fio`/`dio`) `owner/repo` paths, and its add dispatcher passes a `git`
source's URL through to the clone untouched. Its `{source:"url"}` kind is not a clone at all — it
fetches a hosted `marketplace.json`. So our unconditional `ensureGitSuffix` on the network path IS
the defect, and not appending is the fix (D-2-01). `networkCloneUrl(source)` lands in
`domain/clone-key.ts` beside `canonicalCloneUrl` with the same three-kind switch, introducing no type
member and so no `contracts.json` pin (D-2-03). MURL-09 is re-aimed as a no-second-attempt assertion
rather than retired (D-2-04), ROADMAP SC3 becomes a call count of exactly one, and SC4 drops as
vacuous. The one accepted regression: a suffix-less URL against a host serving only `/repo.git`
stops working (D-2-02).

**Phase 1 verification is still open.** `01-VERIFICATION.md` stands at `status: human_needed` with
5/5 must-haves verified — everything provable offline is closed, including the real-credential-helper
link via the scoped canary at `130d68a9`. What remains is one end-to-end clone of a real private repo
on a non-registry host, which needs an operator PAT and a configured helper. The manager projection
reports Phase 1 as `stale` rather than `human_needed`; that is the `covered_files` self-stale class
(the report lists REQUIREMENTS/ROADMAP, which this commit just edited), not a new gap. This blocks
milestone close, not Phase 2.

Plan 01 landed wave 1: `buildAuthForHost` returns a `GitAuthBundle` for every https host, so
`credentialOps.fill(host)` is reached off the two-host registry; `NO_PROVIDER_CAUSE` and
`isAuthChallengeError` are retired and the `update.ts` cause attachment is re-aimed at
`classifyGitTransportFailure` gated on `!hasDeviceFlowProvider(host)`.

Plan 02 landed wave 2, the mitigation for the surface wave 1 widened: `buildAuthCallbacks.onAuth`
compares `new URL(url).host` against the bundle's bound `host` and returns `{ cancel: true }` on a
difference, before `credentialOps.fill` is called, so a foreign URL causes no helper query at all
(GAUTH-06, D-1-03). The `url` parameter is load-bearing and named accordingly. The refusal is
proven twice — at the factory (`credentialOps.calls` empty) and at the transport
(`UserCanceledError`, no `Authorization` header on any recorded request).

Plan 03 landed wave 3 and closed all 20 deliberately-red cases. Each one asserted that the
extension does NOT reach the credential helper on a host the provider registry does not claim;
each now asserts that it does, pinned to the bundle's bound host BY VALUE rather than by key
presence. The two edge suites reduce the recorded bundle to `{ host }` through `describeClone` and
the new `describeFetch`, so the host stays inside the byte-locked deep-equality comparison. Both
flow cases keep their empty-`credentialOps.calls` assertion: a bundle is attached, and nothing is
consulted until the server issues a challenge (PROV-02's surviving half).

**The gate is green at the phase boundary.** `npm run check` exits 0 (`CHECK_EXIT=0`) at
`d5762e0d`: 7261 tests, 7261 pass, 0 fail, `all files | 100.00 | 100.00 | 100.00` with an empty
uncovered-lines cell on every row under `extensions/`, and `fallow` at `FALLOW_EXIT=0`. Phase 2 was
planned from there with `--skip-ui`; Phase 1's verification canary remains deferred to the operator.

**Phase 2 Plan 01 (wave 1) is executed.** `networkCloneUrl(source)` lands in `domain/clone-key.ts`
beside `canonicalCloneUrl`: a 3-arm switch where only the `github` arm appends `.git` (via
`ensureGitSuffix`, keeping that helper's last production consumer alive against `fallow`'s
dead-code gate); the `url` arm derives from `source.raw` so a user-typed `.git` survives to the
wire; `git-subdir` uses `source.url` verbatim. `domain/source.ts` gained `stripSlashAndFragment`,
the `.git`-preserving half of the parse-time strip; `stripUrlDecorations` is now a thin wrapper
adding the `.git` strip on top, behavior-identical to before. `addGitClonedInGuard` derives its
clone url from `args.source` instead of a pre-computed `cloneUrl`, which is now dead and removed
from the args type and both call sites. MURL-09 is pinned as exactly-one-attempt with the sent URL
asserted by value on the success path and on three failure paths (404, 401, and the accepted D-2-02
refusal where a suffix-only host now genuinely fails, naming the URL that was sent). 200 tests
green across the four touched test files, 100% direct coverage on all three touched production
files, `npx tsc --noEmit` / `npm run lint` / `npm run format:check` / `npm run fallow` all exit 0.
Two `check-unused-type-members.contracts.json` pins were remapped from line 539 to 540 (the new
`domain/clone-key.ts` import shifts everything below it by one line) — anticipated by the plan's
own remap contingency, not a surprise. Plans 02-03 remain: plan 02 threads the same derivation
through the three `clone-cache.ts` seam sites and their nine callers; plan 03 owns the residual
suite audit and the phase-boundary `npm run check`.

**Phase 2 Plan 02 (wave 2) is executed.** `materializePluginClone` and
`materializeOrRefreshPluginMirror` in `orchestrators/plugin/clone-cache.ts` gained a REQUIRED
`networkUrl: string` field (no `?`, no default) and stopped deriving a wire url internally;
`resolvePluginPin` now derives its wire url via `networkCloneUrl(source)` instead of
`ensureGitSuffix`, unchanged signature and return type. All nine caller sites across
`install-clone-probe.ts`, `reinstall-clone-probe.ts`, `fetch.ts`, `info.ts`, and
`update-preflight.ts` thread `networkUrl` from the source they already hold. Four
`check-unused-type-members.contracts.json` pins shifted under the new import lines in `info.ts`
(1351→1352) and `update-preflight.ts` (137→138, 138→139, 346→349 — the last by 3 lines, not 1,
because two production edits inside the same file land above it); entry count unchanged at 108.
The direct seam suite (`clone-cache.test.ts`, read in full at 1575 lines) was rewritten from "the
seam appends a suffix" to "the seam forwards what it was handed and keys the disk off the other
value": all 29 literal-construction sites gained the field, six wire-url expectations were
rewritten to the verbatim D-2-03 form, three test titles that still promised the retired
suffix-everywhere rule were retitled from MURL-01 to MURL-08, and a first-ever MURL-09
exactly-one-attempt-plus-identity guard was added for all three seams (success case: count 1 and
the sent url by value; failure case: an injected 404/401/404 whose `message`/`code`/
`data.statusCode` survive unchanged with no retry). `fetch.test.ts`'s owner suite dropped the
suffix from seven of eight wire constants and both template-built allowlists (an A1-class gap a
plain `.git"` grep never caught); `info.test.ts` needed zero edits, since its allowlist already
admits both forms and its assertions never check a recorded URL value. All six touched production
modules hold 100% direct coverage with no new pin row; 270 tests pass across the six touched
seam/owner suites. Empirically confirmed RED at plan end (by design, not regression):
`install-flow.test.ts` (12/157 fail), `update-flow.test.ts` (16/171 fail), and
`tests/integration/marketplace-add-seed-mirrors.test.ts` (5/6 fail) — a narrower set than
ROADMAP/STATE's phase-level prediction, which additionally named bootstrap/reconcile/register/
marketplace-update; those four suites were spot-checked and confirmed GREEN this session. Plan 03
owns closing the confirmed-red set and running the phase-boundary `npm run check` to establish the
authoritative full list.

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| 1 | verification_deferred_human | /gsd-verify-work 1 |

The phase number above is `1`, matching the `number` field `init.manager` emits — that is the
projection `discover_phases` filters against. The phase directory is `01-private-repos-on-any-git-host`;
the zero-padded form is a directory-naming convention, not the queue key.

Phase 1's only outstanding verification item is the live canary: one end-to-end clone of a real
private repo on a non-registry host, which needs operator credentials this machine does not have.
The scoped-canary commit (`130d68a9`) already closed the helper-subprocess link with a negative
control. Deferred so autonomous runs can proceed through phases 2 and 3; milestone close stays
blocked until this is resolved.

## Progress

**Phases Complete:** 0 / 3
**Current Plan:** Phase 2 Plan 02 executed (2/3 plans in phase)

```
Phase 1  [==========]  plans complete (3/3)
Phase 2  [======    ]  in progress (2/3 plans executed)
Phase 3  [          ]  not started
```

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Private repos on any git host | GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06 | Plans complete (3/3), awaiting verification |
| 2 | Endpoints that answer only at the verbatim URL | MURL-08, MURL-09 | In progress (2/3 plans executed) |
| 3 | `marketplace add` recovers from its own leftover clone | MA-12, MA-13, MA-14, GATE-01 | Not started |

## Accumulated Context

### Decisions

- **Phase numbering restarts at 1.** `git-hosts` is a fresh workstream with zero prior phases. The
  repo's shared counter runs to Phase 117 on other workstreams; it does not apply here.
- **Milestone label is a name, not a version.** `any-git-host` follows the `url-source` /
  `force-install` / `workflows` precedent: concurrent workstreams cannot share a global version
  sequence.
- **Three phases, one per defect.** The three defects are independent in behavior but share two
  files (`platform/git.ts`, the `GitOps` seam in `orchestrators/marketplace/shared.ts`), so the
  phases run in sequence rather than in parallel.
- **GAUTH-06 stays in Phase 1 with GAUTH-03.** GAUTH-03 retires the `undefined`-for-no-provider
  refusal that currently stands in as the cross-host leak guard (PROV-04 / T-79-04). Its real
  replacement — a host check inside `onAuth`, which today ignores its `url` argument — must land in
  the same phase, or the milestone opens a window in which a credential bound to one host can
  follow a redirect to another.
- **GATE-01 is mapped to Phase 3** because that is where it is finally measured, but the gate
  surface is a milestone-wide constraint recorded in ROADMAP.md § Milestone-wide constraints and
  must be green at every phase boundary.
- **No new hostname literal in `domain/auth-registry.ts`.** Per-host descriptors for self-hosted
  instances are explicitly out of scope; GAUTH-03 is what makes them unnecessary.
- **Cause-line wording (plan 01):** `no credential stored for ${host}; add one with git credential
  approve`. The host is interpolated once, the command is named literally, and no credential field
  appears (AUTH-09).
- **`NO_PROVIDER_CAUSE` had no residual case** and was retired outright (D-1-04). Authentication is
  now attempted on every host through the credential helper, so "no auth provider is registered for
  {host}" is false everywhere.
- **The `update.ts` guard reuses `classifyGitTransportFailure`** rather than a second hand-rolled
  duck-type: it already folds `HttpError` 401/403 and `UserCanceledError` into one reason, and the
  real failure on an empty helper is `UserCanceledError`, which the old guard could never match.
- **`onAuth` compares `new URL(url).host` against the bundle's bound `host`** and cancels before
  `credentialOps.fill` is called, so a URL on another host causes no helper query at all. The
  `url` parameter is load-bearing and named `url`; `onAuthFailure` keeps its unused `_url`
  because the credential it evicts has already been sent (GAUTH-06, D-1-03).
- **Phase 2 Plan 01: `networkCloneUrl`'s `url` arm reads `source.raw`, never `source.url`.** The
  parse-time-stripped identity form would silently discard a user-typed trailing `.git`; `raw` is
  the string the `https://`-only admission gate already accepted, so no new scheme can enter there.
- **Phase 2 Plan 01: `ALLOWED_MARKETPLACE_REMOTES` is narrowed per `source.kind`, not per hostname
  string.** `https://GitHub.com/acme/mp` (case-sensitive github prefix check) and
  `https://gitlab.com/team/mp` (no gitlab.com literal in this parser) are both `url` kind and both
  drop the `.git` suffix despite the host names looking github/gitlab-adjacent.
- **Edge bundle expectations use the reduced-token shape.** `describeClone` and the new
  `describeFetch` replace a recorded `auth` bundle with `{ host }`, so the bound host stays inside
  the byte-locked deep-equality comparison and a bundle bound to the wrong host fails the suite. A
  bundle carries three closures, so a literal expectation cannot spell it; the host is the field a
  wrong binding would get wrong (T-01-11).
- **`fetch.test.ts::requiredAuth` stays.** It narrows `args.auth` read off the clone-cache seam,
  whose parameter type is still `auth?: GitAuthBundle` because
  `plugin/update-preflight.ts::buildBundle` returns `undefined` when it has no `ctx`. The narrow is
  real, not dead — the same fact keeps `clone-cache.test.ts:538` legitimately asserting an absent
  bundle.
- **Phase 2 Plan 02: `networkUrl` is required on both materialize arg types, never optional or
  defaulted to `cloneUrl`.** A default would compile clean at every un-updated call site and send
  the identity url to a host that needs the suffix; the compiler naming all 39 construction sites
  (9 production, 30 test) is the only completeness guard that scales.
- **Phase 2 Plan 02: the two pass-through-proof cases pass a DIFFERING `cloneUrl`/`wireUrl` pair
  via named locals, not repeated literals.** This is what makes the file-wide
  `gitlab.example.com/o/r.git` count land on exactly 3 (2 locals + 1 allowlist entry) rather than
  5, and is the assertion shape that proves the seam forwards the caller's wire url instead of
  re-deriving it.
- **Phase 2 Plan 02: `info.test.ts` was left untouched, deliberately.** Its `ALLOWED_INFO_REMOTES`
  already admits both suffixed and unsuffixed forms per host, and every one of its assertions is a
  call-count check rather than a recorded-url-value check, so D-2-03's wire-form change is
  invisible to that file's existing suite.

### Source-review facts carried into planning

- `orchestrators/auth-host.ts::buildAuthForHost` returns `GitAuthBundle | undefined` and consults
  `domain/auth-registry.ts::findProviderForHost`, which holds only `GITHUB_PROVIDER` (github.com)
  and `GITLAB_PROVIDER` (gitlab.com), both RFC-8628 Device Flow descriptors.
- `undefined` means `platform/git.ts::clone|fetch|resolveRemoteRef` never call
  `platform/git-auth-callbacks.ts::buildAuthCallbacks`, so `credentialOps.fill(host)` — the
  `git credential fill` shell-out — is never consulted. That is the GAUTH-03 defect.
- `buildAuthCallbacks.onAuth(_url)` already consults `fill(opts.host)` first and only falls through
  to `onAuthRequired()` on a miss. The fix is to always return a bundle and let the registry gate
  only the Device Flow closure — not to add a host descriptor.
- `clone` and `resolveRemoteRef` receive URLs callers already passed through
  `domain/source.ts::ensureGitSuffix`; some smart-HTTP servers answer only at the verbatim path and
  404 the `.git` form (MURL-08).
- `orchestrators/marketplace/add.ts::addGitClonedInGuard` throws `StaleSourceCloneError` whenever
  `sources/<name>/` exists (MA-6), with no way to tell a leftover clone of the same source from a
  foreign tree. Recognizing "same source" needs a new `GitOps.listRemotes` seam in
  `orchestrators/marketplace/shared.ts` and `platform/git.ts`.

### Open TODOs

- Plan Phases 2 and 3 with `--skip-ui`: the `ui_safety_gate` keyword scan false-positives on this
  project's domain vocabulary (`form`, `component`, `view`). No phase in this milestone is a UI
  phase.
- Phase 3 must amend `PROJECT.md`'s D-79-03 row. Its OUTCOME stands — only `update` carries a
  cause line — but its stated RATIONALE ("no `onAuth` callback registered at all for no-provider
  hosts") is false after plan 01. The now-true reason is recorded in
  `orchestrators/plugin/install.messaging.ts`: the plugin failure grammar has no cause-chain
  trailer slot that renders on the subject row.
- A live end-to-end clone of a private repo on a non-registry host, against the operator's own
  credential helper, is untested by design (cases run offline with no credentials) and needs human
  UAT. Recorded as deliverable D4 in `01-01-SUMMARY.md`, and as D5 in `01-02-SUMMARY.md` for the
  host-mismatch refusal against a real remote.

### Blockers

None.

## Session Continuity

**Last session:** 2026-09-27T03:56:10.000Z

**Stopped At:** Phase 2 Plan 02 executed — plugin clone-cache seam threads `networkUrl`, 270 tests green (`a909adaf`, `80251086`, `bfe43963`).
**Resume File:** `.planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-03-PLAN.md`
**Next Action:** `/gsd-execute-phase 2` (plan 03, wave 3 — residual suite audit and the phase-boundary `npm run check`). Phase 1's `human_needed` canary stays open for the operator.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 22min | 2 tasks | 3 files |
| Phase 01 P03 | 41min | 2 tasks | 11 files |
| Phase 02 P01 | 95min | 3 tasks | 8 files |
| Phase 02 P02 | 165min | 3 tasks | 10 files |
