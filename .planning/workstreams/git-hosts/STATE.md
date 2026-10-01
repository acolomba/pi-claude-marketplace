---
gsd_state_version: "1.0"
milestone: any-git-host
milestone_name: Any Git Host
current_plan: none
status: Awaiting next milestone
stopped_at: milestone any-git-host archived (2026-09-30)
last_updated: "2026-09-30T16:17:55.709Z"
last_activity: 2026-09-30
last_activity_desc: "Completed quick task 260930-tlb: clean up clone-cache test temp directories"
state_head: f42e5dd6798bf828812cc5baee2ca6e8671e4500
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 11
  completed_plans: 11
  percent: 100
total_plans_in_phase: 4
current_phase: 2
current_phase_name: Endpoints that answer only at the verbatim URL
---

# Project State

## Project Reference

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after
`/reload`, have every supported Claude plugin component appear as a working Pi-native artifact —
atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Current focus:** none; `any-git-host` closed 2026-09-30 after merging to main in PR #221 (`a0d3aef1`). `any-git-host`
reimplements the three real defects PR #153 (jstillwa) surfaced, rather than merging that PR. A
private source on any git host clones with a credential the user already stored; an endpoint that answers only at its verbatim URL resolves; and `marketplace add`
recovers from its own leftover clone instead of demanding a manual `rm -rf`. The PR's two
Codex-layout changes are out of scope — Claude Code 2.1.274 contains zero references to
`.agents/plugins/` or `.codex-plugin/`.

## Current Position

Phase: Milestone any-git-host complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-09-30 - Completed quick task 260930-tlb: Clean up clone-cache test temp directories

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| — | none | — |

The phase numbers above match the `number` field `init.manager` emits — that is the
projection `discover_phases` filters against. Phase directories are zero-padded
(`02-...`); that is a directory-naming convention, not the queue key.

Phase 1's live canary is CLOSED (2026-09-28, `01-UAT.md` tests 1-3, instrumented local server). Originally: one end-to-end clone of a real
private repo on a non-registry host, which needs operator credentials this machine does not have.
The scoped-canary commit (`130d68a9`) already closed the helper-subprocess link with a negative
control. Deferred so autonomous runs can proceed through phases 2 and 3; milestone close stays
blocked until this is resolved. This item survives Phase 3's completion unchanged; it blocks
milestone close only, not Phase 3 or any phase after it.

Phase 2's live canary is CLOSED (2026-09-28, `02-UAT.md` test 1, instrumented local server). Originally: one `marketplace add` against a REAL
smart-HTTP server that answers only at the verbatim path and 404s the `.git` form, plus a later
`resolveRemoteRef` against it. Every phase test proves the URL that is SENT through the offline
`createGitOpsFake`; none exercises a real HTTP round trip. Recorded in `02-UAT.md`. Deferred by
operator decision on 2026-09-27 so the run could proceed to Phase 3. Both canaries block
milestone close only, not Phase 3. This item likewise survives Phase 3's completion unchanged;
both are also carried forward in `.planning/workstreams/git-hosts/ROADMAP.md` § Milestone-wide
constraints and filed in `.planning/BACKLOG.md` (GHCAN-01, GHCAN-02) for visibility after this
workstream's documents are archived.

## Progress

**Phases Complete:** 2 / 3
**Current Plan:** 4

```
Phase 1  [==========]  4/4 executed; re-verified human_needed (UAT test 16)
Phase 2  [==========]  verified 9/9, live canary deferred
Phase 3  [==========]  4/4 executed; gap closure awaiting re-verification
```

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Private repos on any git host | GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06 | 4/4 executed; re-verified human_needed 4/5, UAT test 16 pending |
| 2 | Endpoints that answer only at the verbatim URL | MURL-08, MURL-09 | Verified 9/9, live canary deferred |
| 3 | `marketplace add` recovers from its own leftover clone | MA-12, MA-13, MA-14, GATE-01 | 4/4 executed; gap closure awaiting code review and re-verification |

## Accumulated Context

### Decisions

- **D-2-05 (operator, 2026-09-27): the `url` cache identity is a FIXED POINT.** A trailing slash
  immediately before a `#<ref>` is normalized away, so `https://host/o/r/#main` and
  `https://host/o/r.git/#main` both have the identity `https://host/o/r` on first parse and on every
  reload. This deliberately overrides the byte-identity-with-pre-phase gate that two earlier review
  passes held, because pre-phase disagreed with itself on that shape and orphaned the clone
  directory. Cost: one re-clone for that input class. The wire form is unaffected — `.../o/r.git/#main`
  still SENDS `.../o/r.git` (D-2-01/D-2-03 separation intact).
- **The `url` identity, the `url` wire form and the `github` identity are three separate
  compositions** in `domain/source.ts` (`stripUrlDecorations`, `stripSlashAndFragment`,
  `stripGitHubUrlDecorations`) sharing only leaf primitives, with no call edge between them. They are
  deliberately NOT collapsed even where two currently agree on ordering: a shared helper is what let
  a wire-side fix move the cache identity once already.

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
- **Phase 2 Plan 03: every flow-suite failure was a blocked-remote artifact, not a stale value
  expectation.** `createGitOpsFake.requireRemote()` runs before an injected `cloneError` is thrown,
  so an allowlist still admitting only the suffixed form silently produced downstream sha/version
  mismatches (a fallback-to-recorded-state shape) rather than a visible `blocked unplanned remote`
  line in most failing cases. Narrowing the allowlist alone brought `install-flow`, `update-flow`,
  and `reinstall-flow` to green with zero additional by-value assertion edits beyond the two
  template-built expectations the plan already named.
- **Phase 2 Plan 03: classification follows the PARSED source kind, never the declared kind or the
  hostname text.** A `github.com` URL declared `source: "url"` in a manifest still parses to
  `github` kind (`domain/source.ts::urlObjectSource` funnels any `https://github.com/...` URL
  through the github parser, D-76-02) — this is why two `install-flow.test.ts` allowlist entries
  declared as `url`-kind manifest entries keep their `.git` suffix.
- **Phase 2 Plan 03: the bootstrap/register family and `reconcile/apply.test.ts`'s two non-empty
  allowlists all resolve through an `owner/repo` shorthand string**
  (`anthropics/claude-plugins-official`, `acme/remote`, `acme/proj`, `acme/user`), which always
  parses to `github` kind regardless of context — confirmed green with no edit, not assumed.
- **Phase 3 Plan 01: `recognizeLeftover()` extracted from `addGitClonedInGuard` to hold fallow's
  cognitive-complexity gate (Rule 1 deviation, not in the plan text).** The inline switch pushed
  complexity to 18 against the 15 threshold; the helper keeps the exhaustive four-arm switch (no
  `default`) so `switch-exhaustiveness-check` still catches a future fifth `ListRemotesResult` arm.
- **Phase 3 Plan 01: the leftover-removal leak and the staging-cleanup leak join into ONE string
  via a new `joinLeaks()` helper** before the single pre-existing `appendLeakToError` call, so
  `unwrapAddError`'s one-level `Error.cause` unwrap contract stays intact (MA-14). No second
  `appendLeakToError` call was added; the count stayed at 4.
- **Phase 3 Plan 01: `tests/orchestrators/marketplace/update.test.ts::makeForbiddenGitOps`
  is a sixth hand-enumerated `GitOps` literal 03-CONTEXT.md/03-VALIDATION.md did not predict** —
  found via `npx tsc --noEmit`, fixed with the same rejecting-stub pattern as its five siblings.
- [Phase 03]: Phase 3 Plan 02: marketplace add's standalone notify() row carries no cause/leak text by design (MpFailed has reasons/severity/plugins only), so both MA-14 cases call addMarketplace twice -- once standalone for the rendered {stale clone} row + subject, once orchestrated for outcome.cause's leak text.
- [Phase 03]: Phase 3 Plan 02: the double-fault MA-14 case must restore sources-staging/ to 0o755 between its two addMarketplace calls -- the first call's onClone leaves it read-only permanently, so an un-restored second call's own fixture-copy mkdir fails before recognition ever runs, misclassifying the whole case as {unparseable}.
- [Phase 03]: Phase 3 Plan 03 (SC5): buildAuthForHost/buildCloneAuth's ctx becomes optional rather than threading a ctx through the cascade -- the guard widens to `provider === undefined || ctx === undefined`, reusing the existing no-provider decline arm verbatim, so the provider-found arm (and both registry hosts) stay byte-identical whenever a real ctx is present.
- [Phase 03]: Phase 3 Plan 03: update-preflight.ts's local buildBundle closure is deleted outright, not kept as a thinner wrapper -- once buildCloneAuth always returns a bundle, the local copy differs from the shared helper only in an early-undefined-return that is now unreachable.
- [Phase 03]: Phase 3 Plan 03 (SC7): PROJECT.md's D-79-03 rationale clause is rewritten to cite the plugin failure grammar's missing cause-chain trailer slot (install.messaging.ts), replacing the now-false "no onAuth callback registered" claim; the row's OUTCOME and the table's Outcome column are untouched.
- [Phase 03]: Phase 3 Plan 03 (SC6): both live canaries are recorded in three places for three different post-close readers -- STATE.md's existing Deferred Verification paragraphs, a new ROADMAP.md subsection, and two new BACKLOG.md entries (GHCAN-01, GHCAN-02) -- rather than in only one.

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
- ~~Phase 3 must amend `PROJECT.md`'s D-79-03 row.~~ CLOSED by 03-03: the rationale clause now
  cites the plugin failure grammar's missing cause-chain trailer slot
  (`orchestrators/plugin/install.messaging.ts`); the OUTCOME is untouched.
- A live end-to-end clone of a private repo on a non-registry host, against the operator's own
  credential helper, is untested by design (cases run offline with no credentials) and needs human
  UAT. Recorded as deliverable D4 in `01-01-SUMMARY.md`, and as D5 in `01-02-SUMMARY.md` for the
  host-mismatch refusal against a real remote.

### Blockers

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260928-tt9 | Fix T-2-10 (url/raw identity mismatch) and T-3-05/WR-11 (duplicate origin url) before ship | 2026-09-28 | add75890 | [260928-tt9-fix-url-raw-identity-mismatch-and-duplic](./quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/) |
| 260930-j4y | Fix the open any-git-host review findings (GHRED-01, GHADD-01) | 2026-09-30 | 1f412768 | [260930-j4y-fix-open-any-git-host-review-findings](./quick/260930-j4y-fix-open-any-git-host-review-findings/) |
| 260930-tlb | Clean up clone-cache test temp directories | 2026-09-30 | 556345c8 | [260930-tlb-clean-up-clone-cache-test-temp-directori](./quick/260930-tlb-clean-up-clone-cache-test-temp-directori/) |

## Session Continuity

**Last session:** 2026-09-28T20:45:00.000Z

**Stopped At:** All phases verified passed; ready for milestone close

**Resume File:** None.

**Next Action:** shipped as PR #221 (2026-09-28); after it merges, `/gsd-complete-milestone --ws git-hosts`. Optionally fix WR-11 (read
`remote.origin.url` with `getConfigAll`, refuse unless exactly one url) before closing.

### What this run completed

- **Phase 2: verified 9/9, live canary deferred.** Three plans executed, then a 3-iteration code
  review loop. Iteration 1 fixed 8 findings and introduced a regression — it moved the parse-time
  cache identity. Iteration 2 caught it. Iteration 3 restructured the `domain/source.ts` seam into
  separately-named compositions with no call edge between them, so a wire-side fix can no longer
  reach the identity. Two operator decisions followed: D-2-05 (the `url` identity is a fixed point,
  chosen over byte-parity because pre-phase contradicted itself and orphaned the clone directory),
  and deferral of the live smart-HTTP canary.
- **Phase 3: discussed, planned, all 3 waves executed.** D-3-01..D-3-04 locked; 3 plans, 3 waves;
  plan-checker passed with zero issues. Wave 2 closed the 100%-branch gate wave 1 declared red.
  Wave 3 fixed the autoupdate cascade (`ctx` optional on `buildAuthForHost`/`buildCloneAuth`),
  carried both live canaries forward, corrected the D-79-03 rationale, and closed the
  phase-boundary `npm run check` green.

### Steps SKIPPED — read before assuming this phase is closable

- **Phase 3 has had no code review and no verification.** Phase 2's review found 2 Criticals on its
  first pass and 2 more after the fix; do not skip this.
- **The two live canaries (GHCAN-01, GHCAN-02) are NOT closable on this machine.** Both are recorded
  in this file (§ Deferred Verification, above), in `ROADMAP.md` § Milestone-wide constraints, and
  in `BACKLOG.md`. They block milestone close only, not Phase 3's own completion.

### Environment debts

- **The isolation sentinel is consumed per dispatch.** `dispatch-isolation --force-isolation none`
  must be re-run immediately before EVERY executor dispatch. Wave 1 succeeded; wave 2's dispatch was
  then refused by the agent-isolation guard because the sentinel had reset. Never verify it with a
  bare call. (Wave 3 of this phase ran sequentially on the main checkout per its own plan note, so
  this did not apply to it.)
- Both live canaries (Phase 1's private-repo clone, Phase 2's verbatim-only smart-HTTP endpoint) stay
  deferred and block MILESTONE CLOSE only, not any phase. Neither is closable on this machine.
- Phase 2's six Info code-review findings (IN-01..IN-06) remain open by scope decision — see
  `02-REVIEW-DISPOSITION.md`, which is the reconciled record; `02-REVIEW.md`'s own
  `status: issues_found` is stale for the Critical/Warning set.
- A `pre-commit npm-lint` hook reported a spurious "files were modified by this hook" failure once
  during this plan's Task 1 re-verification, caused by Task 2's concurrent edits to PROJECT.md/
  ROADMAP.md/STATE.md/BACKLOG.md racing the same pre-commit run. A standalone `eslint` run and a
  third `pre-commit` run on a quiet tree both confirmed clean; no code was affected. See
  `03-03-SUMMARY.md` § Issues Encountered.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 22min | 2 tasks | 3 files |
| Phase 01 P03 | 41min | 2 tasks | 11 files |
| Phase 02 P01 | 95min | 3 tasks | 8 files |
| Phase 02 P02 | 165min | 3 tasks | 10 files |
| Phase 02 P03 | 51min | 3 tasks | 6 files |
| Phase 03 P01 | 55min | 2 tasks | 15 files |
| Phase 03 P02 | ~45min | 2 tasks | 1 files |
| Phase 03 P03 | ~210min | 3 tasks | 9 files |

## Operator Next Steps

The milestone is archived and its code is on main (PR #221, `a0d3aef1`). Nothing
is pending here.

- PR #153 (the contributor PR this milestone reimplemented) is open with a
  comment explaining what landed; close it if there is no reply.
- Open review debt is carried by `BACKLOG.md` GHRED-01 and GHADD-01.
- Start the next milestone with `/gsd-new-milestone`.
