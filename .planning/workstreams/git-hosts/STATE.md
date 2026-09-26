---
gsd_state_version: "1.0"
milestone: any-git-host
milestone_name: Any Git Host
current_phase: 1
current_phase_name: Private repos on any git host
current_plan: 2
total_plans_in_phase: 3
status: Phase 1 plan 01 executed — ready to execute plan 02
stopped_at: "Completed 01-01-PLAN.md; suite intentionally RED until plan 03"
last_updated: "2026-09-26T03:27:21.646Z"
last_activity: 2026-09-26
last_activity_desc: "Executed 01-01: buildAuthForHost returns a bundle for every host, cause line re-aimed at the real failure identity"
state_head: 3edfce6e77dcd58ed16c1409cab73dac5d941cf9
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
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
Current Plan: 2
Total Plans in Phase: 3
Status: Plan 01 of 3 executed and summarized
Last activity: 2026-09-26 — Executed 01-01 (4 commits, GAUTH-03/04/05)

Plan 01 landed wave 1: `buildAuthForHost` returns a `GitAuthBundle` for every https host, so
`credentialOps.fill(host)` is reached off the two-host registry; `NO_PROVIDER_CAUSE` and
`isAuthChallengeError` are retired and the `update.ts` cause attachment is re-aimed at
`classifyGitTransportFailure` gated on `!hasDeviceFlowProvider(host)`.

The unit suite is intentionally RED at the whole-suite level — 20 failures confined to the seven
plugin and edge files plan 03 owns, with the exact case list recorded in `01-01-SUMMARY.md`. Every
other gate (lint, format, typecheck, type-members, corresponding-tests, fallow, direct coverage on
all three touched modules) is green. Next step is `/gsd-execute-phase 1` for plan 02, which adds the
`onAuth` host-mismatch cancel (GAUTH-06) — the replacement for the cross-host cap plan 01 removed.

## Progress

**Phases Complete:** 0 / 3
**Current Plan:** 2 of 3 (phase 1)

```
Phase 1  [===       ]  in progress (1/3 plans)
Phase 2  [          ]  not started
Phase 3  [          ]  not started
```

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Private repos on any git host | GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06 | In progress (1/3 plans) |
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
  UAT. Recorded as deliverable D4 in `01-01-SUMMARY.md`.

### Blockers

None.

## Session Continuity

**Stopped At:** Completed `01-01-PLAN.md` (4 commits, `96d8fe09`..`3edfce6e`); whole-suite RED by
design until plan 03.
**Resume File:** `.planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-02-PLAN.md`
**Next Action:** Execute plan 02 (`onAuth` host-mismatch cancel, GAUTH-06)
