---
gsd_state_version: "1.0"
milestone: any-git-host
milestone_name: Any Git Host
current_phase: 1
current_phase_name: Private repos on any git host
current_plan: 3
total_plans_in_phase: 3
status: Phase 1 plan 02 executed — ready to execute plan 03
stopped_at: "Completed 01-02-PLAN.md; suite intentionally RED until plan 03"
last_updated: "2026-09-26T03:55:42.004Z"
last_activity: 2026-09-26
last_activity_desc: "Executed 01-02: onAuth cancels a credential for a url on another host, proven at the factory and at the transport"
state_head: 7780742f0c527cf8179e7c484e953e8c7fb963ea
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
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

Phase: 1 — Private repos on any git host (in progress)
Current Plan: 3
Total Plans in Phase: 3
Status: Plans 01 and 02 of 3 executed and summarized
Last activity: 2026-09-26 — Executed 01-02 (2 commits, GAUTH-06)

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

The unit suite is intentionally RED at the whole-suite level — still exactly 20 failures, confined
to the seven plugin and edge files plan 03 owns, with the case list recorded in `01-01-SUMMARY.md`.
Plan 02 added none. Every other gate (lint, format, typecheck, type-members, corresponding-tests,
fallow, direct coverage on the touched module) is green. Next step is `/gsd-execute-phase 1` for
plan 03, which realigns the plugin and edge surfaces and takes `npm run check` green at the phase
boundary.

## Progress

**Phases Complete:** 0 / 3
**Current Plan:** 3 of 3 (phase 1)

```
Phase 1  [======    ]  in progress (2/3 plans)
Phase 2  [          ]  not started
Phase 3  [          ]  not started
```

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Private repos on any git host | GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06 | In progress (2/3 plans) |
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
- `npm run test:coverage:unit` stays RED until plan 03 realigns the 20 cases in
  `tests/edge/handlers/marketplace/{add,update}.test.ts` and the five
  `tests/orchestrators/plugin/*` files. The named case list is in `01-01-SUMMARY.md`.
- A live end-to-end clone of a private repo on a non-registry host, against the operator's own
  credential helper, is untested by design (cases run offline with no credentials) and needs human
  UAT. Recorded as deliverable D4 in `01-01-SUMMARY.md`, and as D5 in `01-02-SUMMARY.md` for the
  host-mismatch refusal against a real remote.

### Blockers

None.

## Session Continuity

**Last session:** 2026-09-26T03:55:41.954Z

**Stopped At:** Completed `01-02-PLAN.md` (2 commits, `c55a7466`..`7780742f`); whole-suite RED by design until plan 03.
**Resume File:** `.planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-03-PLAN.md`
**Next Action:** Execute plan 03 (plugin and edge surface realignment, `npm run check` green)

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 22min | 2 tasks | 3 files |
