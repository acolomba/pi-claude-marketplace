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
only at the verbatim path resolve, with a retry narrow enough that it cannot mask a genuine
failure. Third, `marketplace add` learns to tell its own leftover clone from a foreign directory
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
  the `.git`-suffixed path still clones and still resolves refs, with a retry narrow enough that a
  genuine failure keeps its own identity (MURL-08, MURL-09)
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
     memoization, and `NO_PROVIDER_CAUSE` still surfaces wherever it still applies.
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

**Plans**: TBD

### Phase 2: Endpoints that answer only at the verbatim URL

**Goal**: A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed and returns 404 for the conventional `.git`-suffixed form, and a repository that is genuinely missing or genuinely forbidden still fails as itself.

**Depends on**: Phase 1 — both phases change the `clone` / `resolveRemoteRef` path in `platform/git.ts`, and the verbatim-URL attempt must carry the same auth bundle Phase 1 makes universal, or the retry would reach a private endpoint unauthenticated.

**Requirements**: MURL-08, MURL-09

**Success Criteria** (what must be TRUE):

  1. A user can `marketplace add <url>` against a server that answers only at the verbatim path;
     both the initial clone and the later `resolveRemoteRef` (used by `marketplace update`)
     resolve, even though callers pass the URL through `domain/source.ts::ensureGitSuffix` first.
  2. A repository that is absent, private-without-credentials, or otherwise failing keeps its
     original error identity and message — the fallback never rewrites a 401/403/5xx into a
     not-found or a generic failure.
  3. The second attempt fires only on the status that means "wrong path", at most once; any other
     status produces zero extra network calls, verified by a call-count assertion rather than by
     end-state alone.
  4. A failed first attempt leaves the caller's destination exactly as the caller left it — the
     fallback deletes no directory it does not own.
  5. `npm run check` is green, with both retry arms and the no-retry arms at 100%
     lines/functions/branches and an owner unit test for every module touched
     (`test:corresponding`).

**Plans**: TBD

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
| 1. Private repos on any git host | 0/TBD | Not started | — |
| 2. Endpoints that answer only at the verbatim URL | 0/TBD | Not started | — |
| 3. `marketplace add` recovers from its own leftover clone | 0/TBD | Not started | — |
