# Roadmap: pi-claude-marketplace

**Workstream:** git-hosts

## Milestones

- 🚧 **any-git-host — Any Git Host** — Phases 1-3 (planning) — a private git source on any
  host clones with a credential the user already stored, an endpoint that only answers at its
  verbatim URL resolves, and `marketplace add` stops demanding a manual `rm -rf` after a crash

This is the first milestone of the `git-hosts` workstream. Nothing is archived here yet.

## Overview

PR #153 (jstillwa) surfaced three real defects; this milestone reimplements them rather than
merging the PR, and drops its two Codex-layout changes as having no upstream contract to match.
The three defects are independent, but they sit on the same two files —
`platform/git.ts` and the `GitOps` seam in `orchestrators/marketplace/shared.ts` — so the
phases run in sequence rather than in parallel.

The journey moves from the deepest defect outward. First, authentication stops being a
per-hostname allowlist: `buildAuthForHost` always returns a bundle, the provider registry gates
only the Device Flow closure, and the `git credential fill` path that was already written but
never reached becomes the answer for every unregistered host. That change removes the
`undefined`-for-no-provider refusal, which today caps at two hosts the blast radius of a bundle
whose bound host does not match the URL being cloned; the host check inside `onAuth` that replaces
that cap lands in the same phase, never after it. Second, URL sources that answer
only at the verbatim path resolve, because the extension stops appending a `.git` the user never
typed — upstream parity, and narrower than any retry could be. Third, `marketplace add` learns to tell its own leftover clone from a foreign directory
and recovers from the former without ever overwriting the latter.

## Phases

### In progress any-git-host (Any Git Host)

**Phase numbering:** integer phases restart at 1. This is a fresh workstream with zero prior
phases; the repo's shared counter (which runs to Phase 117 on other workstreams) does not apply
here. Decimal phases (1.1, 2.1) are urgent insertions only, marked `INSERTED`.

- [ ] **Phase 1: Private repos on any git host** — a stored credential is consulted on every host,
  not just the two in the provider registry, and the credential stays bound to the host it was
  resolved for (GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06)
- [ ] **Phase 2: Endpoints that answer only at the verbatim URL** — a smart-HTTP server that 404s
  the `.git`-suffixed path still clones and still resolves refs, because the URL sent is the one the
  user typed and exactly one attempt is ever made (MURL-08, MURL-09)
- [ ] **Phase 3: `marketplace add` recovers from its own leftover clone** — a retry after the WR-07
  crash window succeeds instead of demanding a manual delete, while a foreign tree is still refused
  (MA-12, MA-13, MA-14, GATE-01)

## Phase Details

### Phase 1: Private repos on any git host

**Goal**: A Pi user can clone a private marketplace or plugin source over https from any git host using a credential already in their git credential helper — no hostname is added to any registry for it to work — and that credential is never offered to a host other than the one it was resolved for.

**Depends on**: Nothing (first phase of this milestone)

**Requirements**: GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06

**Success Criteria** (what must be TRUE):

  1. With a PAT stored in their git credential helper, a user can `marketplace add` or
     `plugin install` a private https source on a host the provider registry does not claim
     (self-hosted GitLab, Gitea, Forgejo, Bitbucket) and the clone succeeds — `credentialOps.fill(host)`
     is reached because `buildAuthForHost` now returns a bundle for every host, and no hostname
     literal was added to `domain/auth-registry.ts`.
  2. When nothing is stored for such a host, the command fails with a cause line naming
     `git credential approve` as the way to store one, instead of cloning authless and surfacing a
     bare structural 401.
  3. `github.com` and `gitlab.com` behave exactly as they do today — same Device Flow prompt, same
     memoization, and the same bare `{authentication required}` row on a declined flow — it must
     NOT pick up the new stored-credential cause line. (Restated after D-1-04 retired
     `NO_PROVIDER_CAUSE`; the original wording named that symbol, which no longer exists.)
  4. A credential resolved for one host is never sent to another: `buildAuthCallbacks.onAuth`
     cancels when the URL it is handed has a different host than the bundle's bound `host`, making
     a parameter it currently ignores load-bearing. The guard is exercised directly, and
     PROV-04 / T-79-04 is restated against it rather than deleted. Scoping established what it is
     and is not for: `simple-get@4.0.1` already drops `authorization` on a cross-host redirect and
     `git credential fill` is strictly host-keyed (no `path=` line), so the exposure being closed
     is a caller-side host/URL mismatch, not a transport-level leak.
  5. `npm run check` is green, including `tests/architecture/no-credential-leak.test.ts` (no
     credential field reaches an `Error` or a notification) and the no-orchestrator-network gate
     (`orchestrators/auth-host.ts` gains no value import of `platform/git.ts`; a type-only import is
     permitted).

**Plans:** 3/3 plans executed

Plans:

- [x] 01-01-PLAN.md — `buildAuthForHost` returns a bundle for every host; the stored-credential
  cause line replaces the no-provider one and is re-aimed at the failure identity that actually
  occurs; the marketplace add/update surfaces realigned (GAUTH-03, GAUTH-04, GAUTH-05)
- [x] 01-02-PLAN.md — `buildAuthCallbacks.onAuth` cancels when the URL's host differs from the
  bundle's bound host, proven at the factory and at the transport (GAUTH-06)
- [x] 01-03-PLAN.md — the plugin and edge-handler surfaces assert they carry auth on an
  unregistered host; `npm run check` green at the phase boundary (GAUTH-03, GAUTH-05)

### Phase 2: Endpoints that answer only at the verbatim URL

**Goal**: A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Depends on**: Phase 1 — both phases change what reaches `clone` / `resolveRemoteRef` in `platform/git.ts`, and the `scripts/check-unused-type-members.contracts.json` pins are line:col, so one edit at a time keeps them from drifting.

**Requirements**: MURL-08, MURL-09

**Success Criteria** (what must be TRUE):

  1. A user can `marketplace add <url>` against a server that answers only at the verbatim path;
     both the initial clone and the later `resolveRemoteRef` resolve, because the URL sent is the
     one the user typed rather than the `domain/source.ts::ensureGitSuffix` form.
  2. A repository that is absent, private-without-credentials, or otherwise failing keeps its
     original error identity and message — nothing rewrites a 401/403/5xx into a not-found or a
     generic failure.
  3. Exactly ONE network attempt is made per operation, on both the success and the failure path,
     verified by a call-count assertion rather than by end-state alone. There is no second attempt
     and no status-gated retry (D-2-01); the count is the regression guard that would catch one
     being reintroduced.
  4. `.git` is appended only where Claude Code appends it — a `github.com` `owner/repo` path — and a
     `url` source's wire URL preserves the suffix decision the user's own input made, while
     `canonicalCloneUrl` stays the unchanged cache identity so no warm clone cold-misses.
  5. `npm run check` is green, with every arm of the new derivation at 100%
     lines/functions/branches and an owner unit test for every module touched
     (`test:corresponding`).

**Plans:** 3 plans

Plans:

- [ ] 02-01-PLAN.md — `networkCloneUrl` and the slash/fragment strip helper land in `domain/`, and the
  `marketplace add` seam sends them; proven end to end against a git port that admits only the verbatim
  URL, with exactly-one-attempt and original-error-identity cases (MURL-08, MURL-09)
- [ ] 02-02-PLAN.md — the three `clone-cache.ts` seam sites and their nine callers thread a required
  `networkUrl`; the direct seam suite asserts forwarding rather than appending (MURL-08, MURL-09)
- [ ] 02-03-PLAN.md — the residual suite audit that discharges RESEARCH assumption A1, the docstrings
  that still teach the retired rule, and `npm run check` green at the phase boundary (MURL-08, MURL-09)

### Phase 3: `marketplace add` recovers from its own leftover clone

**Goal**: A Pi user retrying `marketplace add` after a crash or a state rebuild succeeds when the directory left behind is a clone of the very source being added, still gets the MA-6 refusal when it is anything else, and is never left with a half-removed tree recorded in state — with the milestone's whole gate surface green at its final HEAD.

**Depends on**: Phase 2 — both phases extend the `GitOps` seam in `orchestrators/marketplace/shared.ts` and its `platform/git.ts` implementation (Phase 3 adds `listRemotes`), and the `scripts/check-unused-type-members.contracts.json` pins are line:col, so one edit at a time keeps them from drifting.

**Requirements**: MA-12, MA-13, MA-14, GATE-01

**Success Criteria** (what must be TRUE):

  1. `marketplace add` succeeds when `sources/<name>/` already holds a leftover clone whose
     `origin` remote is the source being added — the WR-07 crash window and state rebuilds no
     longer require deleting the directory by hand before every retry.
  2. A leftover tree that is not a git clone, is unreadable, or whose `origin` names a different
     URL still refuses with the MA-6 `{stale clone}` row on the marketplace subject; recognition
     never widens into overwriting a directory the extension did not create.
  3. When a recognized leftover clone cannot be fully removed, the add fails as stale with the
     cleanup leak appended (MA-9 discipline) rather than masked, and state records no destination
     for the partially-removed tree.
  4. Every type member this milestone introduced — including the new `listRemotes` seam — is read
     by production code or recorded in `scripts/check-unused-type-members.contracts.json`, and
     `npm run check` passes whole at the milestone's final HEAD: `test:coverage:unit` at 100%
     lines/functions/branches, `test:corresponding`, `lint:type-members`, `fallow`, and the
     `tests/architecture/` gates.
  5. The marketplace **autoupdate cascade** is settled, either fixed or filed with its reason.
     `orchestrators/plugin/update-preflight.ts::buildBundle` returns `undefined` when
     `auth.ctx === undefined`, and `update-flow.ts::updateSinglePluginWith` — the `PluginUpdateFn`
     the cascade invokes — never passes a `ctx`, so that path clones authless. This is
     PRE-EXISTING and host-agnostic (it withholds auth from `github.com` identically), so it is
     not a Phase 1 regression and Phase 1 correctly left it alone. But `ctx` exists only to build
     the Device Flow's `notifyFn`, which the no-provider closure does not need, so the milestone's
     "any git host" prose is broader than what the cascade delivers. Decide explicitly.
  6. Phase 1's deferred runtime UAT is closed or explicitly carried into the next milestone.
     The `DEFAULT_CREDENTIAL_OPS`-against-a-real-helper link is CLOSED (2026-09-26) by a
     `GIT_CONFIG_*`-scoped throwaway `store` helper, with its negative control run first — see the
     amendment banner in `01-VERIFICATION.md`. What remains is ONE end-to-end run: a private repo
     on a non-registry host with a real PAT, cloned through `marketplace add` or `plugin install`.
     Every seam in that chain is individually proven with the real component; their composition in
     one process against one real server is not. Only Phase 1 SC1 rests on it; SC2-SC6 do not. Do
     not mark it passed on the strength of the link-by-link evidence.
  7. `PROJECT.md`'s D-79-03 row is amended. Its OUTCOME still holds — `add` and `install` show a
     bare `(failed) {authentication required}` row and only `update` carries a cause line, which
     is a recorded user checkpoint (2026-07-11) this milestone does not revisit. Its stated
     RATIONALE does not: the row reads "no `onAuth` callback registered at all for no-provider
     hosts — structural fail-clean", and Phase 1 registers one for every host. Rewrite the
     rationale to match what the code does, or the next reader will infer a behavior that no
     longer exists.

**Plans**: TBD

## Milestone-wide constraints

These apply at every phase boundary and are not owned by any single phase. GATE-01 is mapped to
Phase 3 because that is where it is finally measured, but nothing may be left red on the way there.

- `npm run check` stays green at every phase boundary. `test:coverage:unit` enforces 100% lines,
  functions **and** branches over `extensions/**`; a new branch with no test is a failed phase, not
  a follow-up.
- `npm run lint:type-members` fails on any type member no production code reads unless it is
  recorded in `scripts/check-unused-type-members.contracts.json`. Those pins are line:col — expect
  to remap them whenever a phase shifts lines in a pinned file.
- `npm run test:corresponding` requires every production module to have an owner unit test.
- `npm run fallow` runs the dead-code, circular-dependency, health and dupes gates. Check its exit
  code, not its summary glyph.
- `tests/architecture/no-credential-leak.test.ts` (AUTH-09) forbids interpolating any credential
  field into an `Error` or a notification — this binds Phase 1's new cause line in particular.
- The no-orchestrator-network gate forbids `orchestrators/auth-host.ts` from importing
  `platform/git.ts` as a value; type-only imports are permitted.
- No new hostname literal enters `domain/auth-registry.ts`. Per-host descriptors for self-hosted
  instances are explicitly out of scope — GAUTH-03 is what makes them unnecessary.
- These are CLI/backend phases. The `ui_safety_gate` keyword scan false-positives on this project's
  domain vocabulary (`form`, `component`, `view`), so pass `--skip-ui` to `/gsd-plan-phase`; no
  phase in this milestone carries a UI hint.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Private repos on any git host | 3/3 | In Progress | — |
| 2. Endpoints that answer only at the verbatim URL | 0/3 | Planned | — |
| 3. `marketplace add` recovers from its own leftover clone | 0/TBD | Not started | — |
