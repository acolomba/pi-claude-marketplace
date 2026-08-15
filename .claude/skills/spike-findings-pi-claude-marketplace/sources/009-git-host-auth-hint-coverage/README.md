---
spike: 009
name: git-host-auth-hint-coverage
type: standard
validates: "Given a non-github git host clone/auth failure, when the credential/auth-host code emits a diagnostic, then determine whether it already names the actual host across all call sites, and whether Device Flow auth is architecturally pluggable per-host"
verdict: VALIDATED
related: [008]
tags: [auth, git-credential, gitlab, parity]
---

# Spike 009: Git Host Auth-Hint Coverage

## What This Validates

Upstream Claude Code: "...and clone auth-failure hints name your actual git
host." Given that, when a `pi-claude-marketplace` clone against a non-github
host fails auth, then determine (a) whether our existing hints already name
the real host everywhere or only in some call paths, and (b) whether adding
a real second provider (GitLab) is a pure-code change or has an external
prerequisite.

## Research

Pure internal read -- no context7/web docs needed, this is entirely about our
own `domain/auth-registry.ts` / `orchestrators/auth-host.ts` design. Spike
008 already established that a bare `gitlab.com/...` full-scheme URL parses
as a generic git-backed `UrlSource` today, so this spike picks up from
"where does that `UrlSource` go on a clone auth failure."

## How to Run

No script -- this was a targeted read-and-grep investigation (binary
yes/no questions per the workflow's "skip UI" guidance: "does this hint name
the host?", "is Device Flow gated on source.kind === github?"). Verification
commands used, reproducible directly:

```bash
grep -n "NO_PROVIDER_CAUSE\|authentication required" \
  extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts \
  extensions/pi-claude-marketplace/shared/notify-reasons.ts \
  extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
```

## What to Expect

`NO_PROVIDER_CAUSE` (the one host-named hint) has exactly one call site
(`orchestrators/marketplace/update.ts:394`); every other match is the bare,
host-agnostic `"authentication required"` token.

## Investigation Trail

1. Read `domain/auth-registry.ts` in full (at the time of this investigation,
   before GAUTH-02 shipped): `GitAuthProvider` is a compile-time descriptor
   (`id`, `hostMatch`, `deviceCodeUrl`, `tokenUrl`, `clientId`, `scope`,
   `credentialFrom`) built for RFC-8628 Device Flow. `PROVIDERS` held exactly
   one entry, `GITHUB_PROVIDER`, whose `clientId` is a literal public OAuth
   App id (D-32-03). `findProviderForHost` is a plain linear `.find()` over
   `PROVIDERS` keyed by `hostMatch(host)` -- nothing in the lookup mechanism
   is GitHub-specific.
2. Read `orchestrators/auth-host.ts` in full. `hostFromCloneUrl` takes the
   source `kind` ("github" | "url" | "git-subdir") and returns the literal
   `"github.com"` for `kind === "github"` (cheap, no parse needed since
   GitHub sources canonicalize their clone URL), or `new URL(cloneUrl).host`
   for `url`/`git-subdir` -- i.e. **already host-generic for exactly the two
   kinds a bare GitLab URL would produce** (`url` per spike 008, or
   `git-subdir` if path-suffixed). `buildAuthForHost` calls
   `findProviderForHost(host)` uniformly for all three kinds and returns
   `undefined` (no bundle at all, PROV-02/04) when no provider claims the
   host -- confirmed NOT gated on `source.kind === "github"` anywhere in this
   file.
3. Grepped every call site of `NO_PROVIDER_CAUSE` and the
   `"authentication required"` token across the tree (see How to Run).
   Found `NO_PROVIDER_CAUSE` used exactly once, inside `refreshUrlClone`
   in `orchestrators/marketplace/update.ts:394` -- the marketplace `update`
   path for an already-added `url`-kind marketplace. Every other hit
   (`notify-reasons.ts:114`, `git-failure-classifiers.ts:43,47`,
   `install.ts:2024-2026,2106`) is the bare closed-set
   `"authentication required"` string with no host interpolation, and
   `install.ts:2106`'s comment explicitly documents this: the plugin-install
   failure row is `(failed) {authentication required}` with no cause line,
   by design (amended D-79-03).
4. Checked whether any `source.kind === "github"` conditional gates Device
   Flow itself (as opposed to clone-URL reconstruction) -- grepped every
   `kind === "github"` occurrence reachable from the install/reinstall/fetch
   call sites. All are canonical-URL-building or clone-cache-key concerns;
   none gate `buildAuthForHost`/`initiateDeviceFlow`. Confirmed the
   architecture is host-lookup-driven end to end, not kind-driven.
5. Followed the one loose thread: what would actually registering a GitLab
   provider require? `GitAuthProvider.clientId` is a **public OAuth App
   client_id** -- RFC 8628 §3.1 Device Flow has no client secret, so the id
   is safe to commit, but it still has to come from a real OAuth Application
   registered with the target host (GitLab supports RFC 8628 device
   authorization grant natively, so the *protocol* fits) before any code
   change is meaningful. This is an external/human provisioning step, not
   something `findProviderForHost`'s pure-lookup design can supply on its
   own.

## Results

**Verdict: VALIDATED -- partial gap, and it's smaller than it looks.**

- **The auth *architecture* is already host-generic and ready for a second
  provider.** `hostFromCloneUrl` -> `findProviderForHost` -> `buildAuthForHost`
  is a clean per-host lookup with zero `kind === "github"` gating on the auth
  path itself. Adding GitLab support to this layer is, in pure-code terms,
  "append a `GITLAB_PROVIDER: GitAuthProvider` object to `PROVIDERS`" -- no
  interface change, no call-site change in
  `install.ts`/`reinstall.ts`/`fetch.ts`/`update.ts`/`add.ts`, all of which
  already call the same host-generic seam.
- **But that provider needs a real GitLab OAuth Application first** (its
  `deviceCodeUrl`/`tokenUrl`/`clientId` aren't invented -- GitLab's device
  endpoints and a registered public client_id have to exist before the
  descriptor is meaningful). That's an out-of-band provisioning dependency
  the codebase change alone can't close -- worth flagging explicitly so it
  isn't scoped as "just write the descriptor."
- **The user-facing "hints name your actual git host" half of the upstream
  feature is NOT yet true everywhere.** We have exactly the right primitive
  (`NO_PROVIDER_CAUSE(host)`, host-interpolated, no hardcoded provider name)
  but it is wired into exactly one of five auth-relevant call sites --
  `marketplace update`'s url-source refresh path. `plugin install`,
  `plugin reinstall`, `plugin fetch`, and `marketplace add` all still surface
  only the bare, uninformative `"authentication required"` token on a
  no-provider host today (confirmed by the explicit design comment at
  `install.ts:2106`, which calls this out as deliberate for that call site's
  original scope, not an oversight -- but it does mean the upstream-parity
  gap is real if the goal is "hints name the host everywhere," not just on
  `marketplace update`).
- **No NFR-10 containment implications** -- auth bundles never touch disk
  paths. **No new NFR-5 network-boundary risk** -- `install.ts`/`fetch.ts`
  already import `orchestrators/auth-host.ts` (not `platform/git.ts`
  directly) specifically because that file is the sanctioned gate-clean
  re-export point (see its own header comment); a new provider doesn't
  change that shape.
- **Two independently shippable follow-ups fell out of this, not one.**
  (b) shipped same-day: quick task 260814-a7m added `GITLAB_PROVIDER` to
  `domain/auth-registry.ts` (real registered OAuth Application, exact-host
  `hostMatch`, `read_repository` scope, `oauth2`-username `credentialFrom`).
  (a) -- wiring `NO_PROVIDER_CAUSE`-style host-named hints into the other
  four call sites -- is filed as BACKLOG.md GAUTH-01; it is pure code with
  no external dependency and can land independently.
