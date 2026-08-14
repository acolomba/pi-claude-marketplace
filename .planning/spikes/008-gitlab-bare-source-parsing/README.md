---
spike: 008
name: gitlab-bare-source-parsing
type: standard
validates: "Given a bare (schemeless) gitlab.com/group/.../project string or a full https://gitlab.com/... URL with nested subgroups, when passed through parsePluginSource, then determine current classification"
verdict: VALIDATED
related: [009]
tags: [source-parsing, gitlab, parity]
---

# Spike 008: GitLab Bare Source Parsing

## What This Validates

Upstream Claude Code: "bare `gitlab.com` repo URLs (including nested
subgroups) now clone like `github.com` URLs." Given that phrasing, when a
marketplace/plugin `source` field is a bare host-prefixed string (no
`https://`) or a full URL with GitLab-style nested subgroups, then determine
what `parsePluginSource` (`extensions/pi-claude-marketplace/domain/source.ts`)
does with it today.

## Research

No context7/web research needed -- this is a pure read of our own parser
(`domain/source.ts`) plus an executable probe. Read the full file first
(292-line `parsePluginSource` plus helpers) to establish the exact branch
order before probing:

- `raw.startsWith("https://github.com/")` -> `parseGitHubUrl` (owner/repo
  split, exactly 2 segments required).
- `raw.startsWith("https://")` (any other host) -> `parseUrlSource` (MURL-01 /
  D-76-01): the whole path after the host is kept as one opaque URL string,
  no segment splitting.
- Anything else with `slashCount === 1` -> bare `owner/repo` shorthand,
  assumed GitHub (D-76-04).
- Everything else (0 or 2+ slashes, no scheme) -> `unknown`.

That branch order predicts, without running anything, that a bare
`gitlab.com/group/project` (2 slashes) falls into the same `unknown` bucket
as a bare `github.com/owner/repo` (also 2 slashes) -- neither is
special-cased today. It also predicts a full-scheme GitLab URL with any
number of nested subgroups clones fine as an opaque `url` source, since that
branch never splits the path.

## How to Run

```bash
node .planning/spikes/008-gitlab-bare-source-parsing/probe.ts
```

## What to Expect

Nine `parsePluginSource` calls, printed as `{input, result}` JSON lines.

## Investigation Trail

1. Read `domain/source.ts` end to end first (not just grepped) to find every
   branch a `gitlab.com/...` string could hit, since the parser is a
   hand-written character-level cascade (D-06 -- TypeBox deliberately not
   used here) and getting the branch order wrong would invalidate any
   prediction.
2. Predicted `unknown` for all three bare host-prefixed forms (flat, one
   subgroup, two subgroups) and for bare `github.com/owner/repo` -- the
   parser has no host-prefix recognition branch at all, only the
   *scheme-less, already-assumed-GitHub* `owner/repo` shorthand
   (`slashCount === 1`).
3. Predicted `url` kind (git-backed, `GitBackedSource`) for every full
   `https://gitlab.com/...` variant, with the path preserved verbatim
   including arbitrary subgroup depth, `.git` suffix stripped, and `#ref`
   fragment split off -- because `parseUrlSource` never inspects path
   segment count, unlike the GitHub branch's `parts.length !== 2` check.
4. Ran the probe script against 9 cases and confirmed every prediction
   exactly, including the deliberately-included `github.com/owner/repo`
   control case, which confirms the gap is generic (any bare host-prefixed
   form), not GitLab-specific.
5. Cross-checked against `owner/repo` (no host, no scheme) as a sanity
   control -- correctly still resolves to `kind: "github"` (D-76-04
   shorthand), unaffected by anything above.

## Results

**Verdict: VALIDATED -- with a real, generic gap confirmed.**

- **Bare host-prefixed URLs of ANY host (including `github.com` itself) are
  not recognized today.** `gitlab.com/group/project`,
  `gitlab.com/group/subgroup/project`, and even `github.com/owner/repo` all
  return `{ kind: "unknown", reason: "non-relative string source ... cannot
  be classified" }`. The only bare (schemeless) form we support is the
  *implicit*-GitHub `owner/repo` shorthand (exactly one slash, D-76-04) -- we
  never learned a bare *host-prefixed* form for any provider. If any upstream
  marketplace.json in the wild starts using the new bare-gitlab-with-subgroups
  convention (or the pre-existing bare-github-host convention, if that's
  what upstream is byte-parity to), our resolver returns `unknown` and the
  plugin/marketplace entry silently fails to resolve rather than installing.
- **Full-scheme GitLab URLs -- including arbitrarily deep nested subgroups --
  already work today, with zero code changes needed.** `parseUrlSource`
  treats the whole path as one opaque string (`UrlSource.url`), so subgroup
  depth is a non-issue for anything already typed with `https://`. This is
  the pleasant surprise of the spike: "nested subgroups" sounds like it wants
  bespoke parsing, but it's actually a non-problem for any source already
  going through the generic `url` branch. It only becomes a problem the
  moment you want a **bare, schemeless** shorthand, because that's the one
  code path (currently GitHub-only, `owner/repo`) that assumes a fixed
  2-segment shape.
- **Fix shape, if picked up:** add a bare-host-prefix recognition branch
  ahead of the `slashCount === 1` owner/repo check -- e.g. `raw.startsWith(
  "gitlab.com/")` / a small allow-listed-host table -> re-prefix with
  `https://` and re-enter `parseUrlSource` (or `parseGitHubUrl` for a
  `github.com/` bare prefix, to preserve owner/repo Device-Flow identity).
  This is a pure `domain/source.ts` addition -- no `ParsedSource` union
  change, no bridge/orchestrator change, since the output is still a plain
  `UrlSource` (or existing `GitHubSource` for the github.com case). No new
  discriminated source kind is warranted.
- **NFR-10 / NFR-5 implications: none new.** A bare-form fix only changes
  which *branch* a string lands in during `parsePluginSource` (pure,
  network-free, domain-layer). It doesn't touch `platform/git.ts` or the
  containment chokepoint (`shared/path-safety.ts`) at all -- those already
  operate on the resolved `UrlSource.url` regardless of whether it arrived
  bare or full-scheme.

Filed to BACKLOG.md as SRCP-01/02.
