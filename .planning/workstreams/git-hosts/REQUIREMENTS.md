# Requirements: any-git-host (milestone, workstream `git-hosts`)

**Defined:** 2026-09-25
**Core Value:** A Pi user can install a Claude plugin and load each supported component as a working Pi artifact.
**Driver:** Review of PR #153 (jstillwa). Three of its five changes address real defects; they are
reimplemented here rather than merged. The two Codex-layout changes are dropped — Claude Code
2.1.274 contains no reference to `.agents/plugins/` or `.codex-plugin/` (`.claude-plugin` appears
125 times, the other two zero), so there is no upstream contract to match.

## v1 Requirements

### Host-Agnostic Authentication

Today `orchestrators/auth-host.ts::buildAuthForHost` returns `undefined` for any host the provider
registry does not claim, and only `github.com` and `gitlab.com` are claimed. No bundle means
`platform/git.ts` never builds auth callbacks, which means `credentialOps.fill(host)` — the
`git credential fill` lookup — is never consulted. A PAT already stored in the user's credential
helper is therefore invisible to this extension on every other host.

- [x] **GAUTH-03**: A user can clone a private marketplace or plugin source over https from any git
  host using a credential already stored in their git credential helper, with no host-specific code.
  No hostname literal is added to the provider registry for this to work.
- [x] **GAUTH-04**: When no stored credential is found for a host that has no Device Flow, the
  command fails with a cause line naming how to store one (`git credential approve`), instead of
  cloning authless and failing on a bare structural 401.
- [x] **GAUTH-05**: `github.com` and `gitlab.com` keep today's Device Flow behavior
  byte-for-behavior — same prompt, same once-per-host memoization, same failure rendering.

  *Amended during Phase 1 execution:* the original wording said "same `NO_PROVIDER_CAUSE` surface
  where it still applies". D-1-04 retired that constant outright, so the clause named a symbol
  that no longer exists and a surface that applies nowhere. The substantive guarantee is
  unchanged and is what the phase asserts: a declined Device Flow on a registry host still
  renders a bare `{authentication required}` row and must NOT pick up the new stored-credential
  cause line — which is exactly what `hasDeviceFlowProvider` in the `update.ts` guard prevents.
- [x] **GAUTH-06**: A credential resolved for one host is never offered to a different host. When
  `buildAuthCallbacks.onAuth` is invoked for a URL whose host differs from the bundle's bound
  `host`, it cancels instead of returning the filled credential.

  This guards the CALLER-side binding, not the redirect path. Verified while scoping, so that the
  guard is built against the real exposure rather than the assumed one: `onAuth` is only ever
  invoked by isomorphic-git with the caller's own URL (`index.cjs` `discover`, on 401/203 — never
  a redirect target), and `simple-get@4.0.1` already deletes `authorization` and `cookie` on a
  cross-host redirect (`node_modules/simple-get/index.js:57-60`). `credentialFill` emits
  `protocol=https` + `host=` and never `path=`, so `git credential fill` is strictly host-keyed.
  PROV-04's `undefined`-for-no-provider refusal was therefore never the thing preventing a
  transport-level leak.

  What it DOES protect: `onAuth` ignores its `url` argument today, so a bundle constructed for
  host A would silently authenticate a clone of host B. PROV-04 caps that blast radius at two
  hosts; GAUTH-03 removes the cap. The guard turns a caller-side mismatch into a cancel instead
  of a credential disclosure, and makes the previously-ignored parameter load-bearing.

  *Amended during Phase 1 gap closure (G-01-4):* `simple-get@4.0.1` compares hostnames only
  (`index.js:57-59`), so a redirect to another port, or to `http:` on the same hostname, carried
  the `Authorization` header. UAT measured the port case on the wire. Planning measured the
  cleartext `http:` case through the real transport. GAUTH-06 therefore covers the redirect path
  too: `platform/git.ts` follows redirects itself and never forwards a credential header to a hop
  whose origin differs from the request's. The origin is scheme, host and port, with the default
  https port removed. A cross-origin redirect is still followed, without the credential, as git
  over libcurl does it (CVE-2022-27776).

### URL Forms for Non-Conventional Git Endpoints

- [x] **MURL-08**: A user can add a `url` marketplace source whose smart-HTTP endpoint serves at the
  verbatim URL and returns 404 for the conventional `.git`-suffixed form. Both `clone` and
  `resolveRemoteRef` resolve it.
- [x] **MURL-09**: The URL sent to a remote is exactly the one the user typed, modulo trailing-slash
  and `#<ref>` decoration stripping, and exactly ONE network attempt is made per operation. A
  repository that is genuinely absent, private-without-credentials, or otherwise failing therefore
  keeps its original error identity — there is no second attempt to mask it with. `.git` is appended
  only where Claude Code appends it: a `github.com` `owner/repo` path.

### Marketplace Add Recovery

- [x] **MA-12**: `marketplace add` succeeds when `sources/<name>/` already holds a leftover clone
  whose `origin` URL is the source being added — the WR-07 crash window and state rebuilds no longer
  require deleting the directory by hand before every retry.
- [x] **MA-13**: A leftover tree that is not a git clone, is unreadable, or whose `origin` names a
  different URL still refuses with the MA-6 `{stale clone}` row on the marketplace subject.
- [x] **MA-14**: When the leftover clone cannot be fully removed, the add fails as stale with the
  cleanup leak appended (MA-9 discipline) rather than masked, and no partially-removed destination
  is left recorded in state.

### Gate Conformance

- [x] **GATE-01**: Every type member introduced by this milestone is read by production code or
  recorded in `scripts/check-unused-type-members.contracts.json`; `npm run check` passes whole,
  including `test:coverage:unit` at 100% lines/functions/branches.

## v2 Requirements

(None.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| `.agents/plugins/marketplace.json` (Codex marketplace layout) | No upstream support: zero occurrences in the Claude Code 2.1.274 binary. Adding it would be a pi-only divergence to maintain forever. |
| `.codex-plugin/plugin.json` (Codex plugin layout) | Same — no upstream contract to match. |
| Per-host provider descriptors for self-hosted instances (Gitea, Forgejo, self-hosted GitLab) | GAUTH-03 makes them unnecessary. A hostname literal in a registry we ship serves exactly one deployment. |
| Device Flow for hosts that do not implement RFC 8628 | There is no flow to run. The stored-credential path is the whole answer for those hosts. |
| Runtime/per-source provider configuration | PROV-07, already deferred to v2. |
| SSH transport | isomorphic-git over https only (D-18/D-21). Unchanged by this milestone. |

## Traceability

Populated at roadmap creation (2026-09-25). Full phase definitions, success criteria and the
milestone-wide gate constraints: `.planning/workstreams/git-hosts/ROADMAP.md`.

Phase numbering restarts at 1 — `git-hosts` is a fresh workstream and does not continue the
repo's shared counter.

- **Phase 1** — Private repos on any git host
- **Phase 2** — Endpoints that answer only at the verbatim URL
- **Phase 3** — `marketplace add` recovers from its own leftover clone

| Requirement | Phase | Status |
|-------------|-------|--------|
| GAUTH-03 | Phase 1 | Complete |
| GAUTH-04 | Phase 1 | Complete |
| GAUTH-05 | Phase 1 | Complete |
| GAUTH-06 | Phase 1 | Complete |
| MURL-08 | Phase 2 | Complete |
| MURL-09 | Phase 2 | Complete |
| MA-12 | Phase 3 | Complete |
| MA-13 | Phase 3 | Complete |
| MA-14 | Phase 3 | Complete |
| GATE-01 | Phase 3 | Complete |

**Coverage:**

- v1 requirements: 10 total
- Mapped to phases: 10 (Phases 1-3)
- Unmapped: 0
- Duplicated across phases: 0

GATE-01 is mapped to Phase 3 because that is where the whole gate surface is finally measured, but
it is enforced as a milestone-wide constraint at every phase boundary (ROADMAP.md
§ Milestone-wide constraints).

---

*Requirements defined: 2026-09-25*
