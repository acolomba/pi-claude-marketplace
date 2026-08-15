# GitLab Plugin-Marketplace Parity

**Status: mostly already shipped.** This reference is retrospective --
GitLab Device Flow auth (GAUTH-02) landed via PR #128 the same day these
spikes ran. What's below documents what's true today and what's still
open, not a forward build plan.

## Requirements

- A GitLab (or any other host) `url`-kind source keeps using the existing
  opaque full-URL identity (`UrlSource.url`) -- no new host-specific type
  is needed for path/clone purposes, since arbitrary subgroup nesting is
  just more path segments to a generic URL.
- A GitLab Device Flow auth provider requires a real GitLab OAuth
  Application registered out-of-band first -- `clientId` is a
  compile-time literal (D-32-03) that has to come from somewhere; this is
  a human/infra prerequisite a code change alone can't satisfy (it was
  satisfied -- `GITLAB_PROVIDER` uses a real registered public OAuth App).

## Current State

**Source parsing (`domain/source.ts`):** full-scheme GitLab URLs already
work with zero code changes, at any subgroup depth --
`https://gitlab.com/group/subgroup/project` parses as a plain
`UrlSource`, since `parseUrlSource` treats the whole path after the host
as one opaque string and never splits on segment count (unlike the
GitHub branch's `parts.length !== 2` check). Bare, schemeless
host-prefixed forms (`gitlab.com/group/project`, and even
`github.com/owner/repo`) are NOT recognized -- they fall through to
`{kind: "unknown"}`. The only bare form supported is the
already-assumed-GitHub `owner/repo` shorthand (exactly one slash, D-76-04).

**This is confirmed to be at parity with upstream, not a gap.** The
upstream changelog line that triggered this spike ("bare `gitlab.com`
repo URLs, including nested subgroups, now clone like `github.com` URLs")
was initially read as "upstream added a new bare-schemeless GitLab
shorthand." Probing the real, installed `claude` CLI v2.1.232 directly
disproved that: `claude plugin marketplace add
"gitlab.com/acolomba/pi-cm-test-marketplace"` is rejected outright ("not
a valid GitHub owner/repo shorthand..."), identically to this project's
own behavior. The changelog line actually described full `https://` URLs
reaching parity with how GitHub URLs already worked -- not a new bare
form. **`BACKLOG.md`'s SRCP-01 item is marked WITHDRAWN for this reason.**
Don't re-open it without new upstream evidence.

**Auth architecture (`domain/auth-registry.ts` /
`orchestrators/auth-host.ts`):** already fully host-generic before GitLab
was added. `hostFromCloneUrl` -> `findProviderForHost` -> `buildAuthForHost`
is a per-host lookup with zero `kind === "github"` gating anywhere on the
auth path -- adding a second provider was "append a descriptor," not an
architecture change. `GITLAB_PROVIDER` now lives in `PROVIDERS` alongside
`GITHUB_PROVIDER`.

## What to Avoid

- Don't re-litigate SRCP-01 (bare host-prefixed shorthand) without first
  re-probing the real `claude` CLI against current upstream behavior --
  the withdrawal was based on direct testing, not speculation, and
  upstream could change again.
- Don't assume `source.kind === "github"` gates Device Flow anywhere --
  it doesn't; the auth path is uniformly host-lookup-driven for all
  source kinds (`github`, `url`, `git-subdir`).

## Constraints

- **SRCP-02 (still open):** the `git-subdir` object source's `url` field
  is taken as a literal string with no shorthand expansion. Upstream's own
  git-subdir docs document `url` accepting the bare `owner/repo` GitHub
  shorthand alongside the separate `path` field; this project's parser
  doesn't, and would fail at clone time on such an entry.
- **GAUTH-01 (still open):** the host-named auth-failure hint
  (`NO_PROVIDER_CAUSE(host)`) is wired into exactly one of five
  auth-relevant call sites (`marketplace update`'s url-source refresh
  path). `plugin install`, `plugin reinstall`, `plugin fetch`, and
  `marketplace add` still surface the bare, uninformative
  `"authentication required"` token on a no-provider host. Pure code,
  no external dependency -- can land independently.
- A new git-host provider needs a real, registered OAuth Application
  before its descriptor means anything -- RFC 8628 Device Flow has no
  client secret, so the `clientId` is safe to commit, but it still has to
  exist on the provider's side first.

## Origin

Synthesized from spikes: 008, 009
Source files available in: `sources/008-gitlab-bare-source-parsing/`,
`sources/009-git-host-auth-hint-coverage/`
