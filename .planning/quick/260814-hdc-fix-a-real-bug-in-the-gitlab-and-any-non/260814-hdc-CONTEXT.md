# Quick Task 260814-hdc: Fix GitLab (and any non-GitHub url-kind) marketplace clone `.git`-suffix bug - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Task Boundary

Fix a real bug in the GitLab (and any non-GitHub `url`-kind) marketplace clone
path: cloning a full `https://gitlab.com/...` URL currently fails because the
parser strips the `.git` suffix for identity comparison, but the same
stripped value is also used verbatim as the actual network clone URL, which
breaks against GitLab's smart-HTTP redirect behavior.

</domain>

<decisions>
## Implementation Decisions

### Fix shape
- Re-append `.git` at the clone/fetch-call sites where a `url`-kind (and
  `git-subdir`-kind, if affected) source's URL becomes an actual network
  clone URL. Keep parse-time `.git` stripping and D-76-01 identity
  comparison (`sourceLogical`/`samePlannedSource`) exactly as-is -- untouched,
  no risk to existing comparison semantics. Smallest, most surgical change.

### Fix breadth
- Host-agnostic: always ensure the actual clone/fetch URL ends in `.git` for
  every `url`-kind (and `git-subdir`-kind) source, regardless of host -- NOT
  scoped narrowly to `gitlab.com`. Rationale (discussed live): the `.git`
  suffix itself is a general git-hosting convention, not GitHub/GitLab
  specific; the confirmed failure (a redirect on the `.git`-less form
  downgrading the POST `git-upload-pack` request to a bodyless GET) has only
  been verified against `gitlab.com`, but the fix costs nothing to apply
  universally and preempts the same latent bug for any other host
  (Bitbucket, self-hosted GitLab, etc.) that behaves the same way under the
  hood. Mirrors how GitHub's own clone-URL construction already always
  appends `.git`.

### Claude's Discretion
- Whether `git-subdir`-kind sources have the identical bug (confirm during
  planning by reading `domain/source.ts`'s `gitSubdirObjectSource` and
  tracing where `GitSubdirSource.url` becomes a `cloneUrl`/`fetchUrl`).
- Exact test strategy, so long as it does not require live network access to
  a real git host (mock-based, asserting the URL actually passed to the
  mocked clone/fetch call retains `.git`).
- Every call site across `orchestrators/marketplace/add.ts` and
  `orchestrators/plugin/*` that reads a `url`-kind or `git-subdir`-kind
  source's `.url` field and passes it to `platform/git.ts` clone/fetch must
  be covered, not just the marketplace add path.

</decisions>

<specifics>
## Specific Ideas

Live evidence gathered today via a standalone repro script exercising the
real `platform/git.ts` + `domain/source.ts` code directly against the live
gitlab.com API (not mocked), same cached `oauth2` credential both times:

- `clone({ url: "https://gitlab.com/acolomba/pi-cm-test-marketplace" })` (no
  `.git`) -> fails in 760ms: `HttpError: HTTP Error: 422 Unprocessable
  Entity`, stack trace through isomorphic-git's `GitRemoteHTTP.connect`.
- `clone({ url: "https://gitlab.com/acolomba/pi-cm-test-marketplace.git" })`
  (identical everything else, `.git` appended) -> succeeds in 651ms.

Root cause chain:

- `domain/source.ts`'s `parseUrlSource` -> `stripUrlDecorations` strips a
  trailing `.git` at parse time (D-76-01, for `sourceLogical`/
  `samePlannedSource` identity comparison).
- `orchestrators/marketplace/add.ts:775-788` (documented "MURL-01 / D-76-06:
  url-source add. Clones `source.url` VERBATIM") passes that already-stripped
  `source.url` straight through as `cloneUrl`.
- `platform/git.ts`'s `CloneOptions.url` doc comment confirms the
  verbatim-passthrough is by design.
- GitHub is unaffected: `orchestrators/marketplace/add.ts:726` reconstructs
  `` `https://github.com/${owner}/${repo}.git` `` fresh every time, always
  `.git`-suffixed, never touching `parseUrlSource`'s stripping.
- Mechanism: GitLab's smart-HTTP endpoint 301-redirects the `.git`-less
  info/refs request; `simple-get` (isomorphic-git/http/node's transport)
  downgrades a redirected `POST git-upload-pack` to a bodyless `GET` per its
  own explicit code, and GitLab rejects the bodyless request with 422.

The user also reproduced this live through the real Pi extension
(`/claude:plugin marketplace add https://gitlab.com/acolomba/pi-cm-test-marketplace`),
completing a real GitLab Device Flow authorization, and got
`Extension "command:claude:plugin" error: Request timed out` -- "Request
timed out" is `simple-get`'s own exact socket-timeout string (confirmed
absent from our own code). Very likely the same root cause manifesting as a
hang instead of a fast 422 under different network/credential conditions;
not independently re-verified live, but the missing-`.git` mechanism alone
already fully explains a broken clone either way.

</specifics>

<canonical_refs>
## Canonical References

- `extensions/pi-claude-marketplace/domain/source.ts` (`parseUrlSource`,
  `stripUrlDecorations`, D-76-01 comment)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
  (~lines 720-790: github-source vs url-source add paths, D-76-06/MURL-01
  comments)
- `extensions/pi-claude-marketplace/platform/git.ts` (`CloneOptions.url` doc
  comment, `clone()`)
- `node_modules/simple-get/index.js` (the POST->GET redirect downgrade and
  the `Request timed out` string)

</canonical_refs>
