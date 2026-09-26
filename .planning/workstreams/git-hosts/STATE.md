---
gsd_state_version: "1.0"
milestone: any-git-host
milestone_name: Any Git Host
current_phase: 1
current_phase_name: Private repos on any git host
current_plan: 3
total_plans_in_phase: 3
status: Phase 1 complete (3/3 plans) — awaiting verification
stopped_at: "Completed 01-03-PLAN.md (3 commits, 1c7d6e52..d5762e0d); npm run check exits 0"
last_updated: "2026-09-26T04:42:43.870Z"
last_activity: 2026-09-26
last_activity_desc: "Executed 01-03: the plugin and edge surfaces assert they carry a host-keyed bundle; npm run check exits 0 with 0 failing tests"
state_head: d5762e0da783a6cb9560dcb0542d733aa9a393fe
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 3
  percent: 0
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

Phase: 1 — Private repos on any git host (all 3 plans executed, awaiting verification)
Current Plan: 3
Total Plans in Phase: 3
Status: Plans 01, 02 and 03 of 3 executed and summarized
Last activity: 2026-09-26 — Executed 01-03 (3 commits, GAUTH-03 / GAUTH-05 on the plugin and edge surfaces)

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
uncovered-lines cell on every row under `extensions/`, and `fallow` at `FALLOW_EXIT=0`. Next step
is verification of Phase 1, then `/gsd-plan-phase 2` with `--skip-ui`.

## Progress

**Phases Complete:** 0 / 3
**Current Plan:** 3 of 3 (phase 1)

```
Phase 1  [==========]  plans complete (3/3)
Phase 2  [          ]  not started
Phase 3  [          ]  not started
```

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Private repos on any git host | GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06 | Plans complete (3/3), awaiting verification |
| 2 | Endpoints that answer only at the verbatim URL | MURL-08, MURL-09 | Not started |
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

**Last session:** 2026-09-26T04:42:35.574Z

**Stopped At:** Completed `01-03-PLAN.md` (3 commits, `1c7d6e52`..`d5762e0d`); `npm run check` exits 0 with 0 failing tests.
**Resume File:** None
**Next Action:** Verify Phase 1, then plan Phase 2 with `--skip-ui`

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 22min | 2 tasks | 3 files |
| Phase 01 P03 | 41min | 2 tasks | 11 files |
