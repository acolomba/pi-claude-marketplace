// domain/clone-key.ts
//
// PURL-04 / D-77-04: source-addressed plugin-clone cache key.
//
// A plugin clone is deduped by SOURCE, not by name -- two differently named
// plugins pointing at the same canonical url + resolved commit sha share one
// clone. The key is `<12hex(sha256(canonicalUrl))>-<sha12>`:
//   - Left half: SHA-256 of the canonical clone URL, truncated to 12 hex.
//   - Right half: the first 12 hex chars of the resolved 40-hex commit sha.
// Fixed-length and filesystem-safe for any https URL (no sanitization edge
// cases). state.json records the full resolved sha per plugin (D-77-02,
// `resolvedSha`); the clone URL itself lives on the marketplace manifest
// entry's source, so a human-readable reverse lookup remains possible without
// parsing the key.

import { createHash } from "node:crypto";

import { GITHUB_ORIGIN, gitHubAddressOf } from "../shared/github-base-url.ts";

import { ensureGitSuffix, parsePluginSource, stripSlashAndFragment } from "./source.ts";

import type { GitHubSource, GitSubdirSource, UrlSource } from "./source.ts";

/**
 * D-77-04: truncation width shared with the PI-7 hash-version convention
 * (`domain/version.ts::HASH_TRUNC`). Both halves of the key are 12 hex chars.
 */
const KEY_TRUNC = 12;

/**
 * PURL-04 / D-77-04: derive the cache key for a plugin clone.
 *
 * `canonicalUrl` is the caller's responsibility to pre-canonicalize (parse-time
 * `.git`-stripped, `#ref`-split form). This helper does NOT canonicalize -- it
 * hashes the URL verbatim, so callers that reconstruct the same canonical URL
 * from different source shapes (url vs github-object) get the same left half
 * and dedup to one clone. `fullSha` is the resolved 40-hex commit sha.
 */
export function pluginCloneKey(canonicalUrl: string, fullSha: string): string {
  const left = createHash("sha256").update(canonicalUrl).digest("hex").slice(0, KEY_TRUNC);
  return `${left}-${fullSha.slice(0, KEY_TRUNC)}`;
}

/**
 * MIRR-01 / D-79.1-01: the URL-only mirror key for an unpinned git plugin
 * source.
 *
 * An unpinned source (no resolved `sha`) is backed by exactly ONE mutable
 * mirror clone per canonical URL at `plugin-clones/<urlhash12>/` -- a bare
 * 12-hex key with NO `-<sha12>` suffix. This is precisely the left half of
 * `pluginCloneKey`: `sha256(canonicalUrl)` truncated to 12 hex. The bare key
 * makes multi-clone ambiguity impossible by construction -- one URL maps to
 * one mirror dir regardless of the moving HEAD/ref it currently tracks.
 *
 * Pure -- no network, no gitOps, no fs. `canonicalUrl` is the caller's
 * responsibility to pre-canonicalize (same contract as `pluginCloneKey`).
 */
export function pluginMirrorKey(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex").slice(0, KEY_TRUNC);
}

/**
 * D-77-06 / PURL-07: reconstruct the canonical clone url for a git plugin
 * source -- the exact string both key helpers above hash over. Single-sourced
 * here so the clone seam (clone-cache.ts) and the fs-only presence probe
 * (git-source-probe.ts) can never drift and key different directories. Pure --
 * no network, no gitOps; reinstall reuses this to derive the clone url from
 * the recorded source WITHOUT triggering pin re-resolution.
 *
 *   - github-object: `https://github.com/<owner>/<repo>` (D-77-06). A url
 *     entry and a github entry naming the same repo dedup to one clone.
 *   - url / git-subdir: `source.url` verbatim. For a url source the parser
 *     already produced the parse-time canonical form (`.git`-stripped,
 *     `#ref`-split, D-76-01), so its dedup is `.git`-suffix-insensitive. A
 *     git-subdir source's `source.url` is the url its manifest wrote, `.git`
 *     kept, so `repo` and `repo.git` name two keys; mirror seeding compares
 *     them without the suffix (D-SEED-01). For git-subdir the clone url is
 *     the repo root; the subdir path is resolved later by the resolver
 *     (git-subdir pluginRoot = cloneRoot + path).
 *
 * The result is the cache-key IDENTITY, not a wire url: a caller sending it to
 * the network derives the wire form from `networkCloneUrl` instead (D-2-03).
 * Folding that suffix in here instead would rehash every `plugin-clones/`
 * directory and cold-miss every warm clone.
 */
export function canonicalCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  return source.kind === "github" ? `${GITHUB_ORIGIN}/${source.owner}/${source.repo}` : source.url;
}

/**
 * D-2-01 / D-2-03: derive the wire url actually sent to the network for a
 * git-backed source, as distinct from `canonicalCloneUrl`'s cache-key
 * identity above. `.git` is appended only where Claude Code appends it -- the
 * `github` arm -- and the `url` arm preserves whatever `.git` decision the
 * user's own input made, deriving from `source.raw` rather than the
 * parse-time `.git`-stripped `source.url` so that decision is never silently
 * discarded.
 */
export function networkCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  switch (source.kind) {
    case "github":
      return ensureGitSuffix(canonicalCloneUrl(source));
    case "url":
      return stripSlashAndFragment(source.raw).base;
    case "git-subdir":
      return stripSlashAndFragment(source.url).base;
  }
}

/**
 * D-SG-23: whether two repository identities name one GitHub repository, the
 * way Claude Code folds them: true or false when either folds through
 * `gitHubAddressOf` (a GitHub identity never matches a non-GitHub one), and
 * undefined when neither does, so the caller runs its own exact compare.
 */
export function gitHubRepositoriesMatch(identity: string, other: string): boolean | undefined {
  const repository = gitHubAddressOf(identity)?.repository;
  const otherRepository = gitHubAddressOf(other)?.repository;
  return repository === undefined && otherRepository === undefined
    ? undefined
    : repository === otherRepository;
}

/**
 * Q-03 / MA-12 / D-SG-23: whether a leftover clone's recorded `origin` url
 * names the same repository as `source`. Every GitHub spelling folds first
 * (`gitHubRepositoriesMatch`), so `git@github.com:Acme/Tools.git`,
 * `ssh://git@github.com/acme/tools`, and the github source `acme/tools` are
 * one repository, the owner and repo compared without case (closes IN-05). A
 * non-GitHub origin reduces to its `canonicalCloneUrl` identity, which strips
 * a trailing `.git` and a `#<ref>`, and compares exactly with the source's:
 * after WHATWG URL normalization when both are URLs, so the host compares
 * case-insensitively (RFC 3986 section 3.2.2), and as text when either is an
 * scp address. An origin that parses to another kind never matches.
 */
export function originMatchesSource(originUrl: string, source: GitHubSource | UrlSource): boolean {
  const sourceIdentity = canonicalCloneUrl(source);
  const gitHubMatch = gitHubRepositoriesMatch(originUrl, sourceIdentity);
  if (gitHubMatch !== undefined) {
    return gitHubMatch;
  }

  const origin = parsePluginSource(originUrl);
  if (origin.kind !== "github" && origin.kind !== "url") {
    return false;
  }

  const originIdentity = canonicalCloneUrl(origin);
  return URL.canParse(originIdentity) && URL.canParse(sourceIdentity)
    ? new URL(originIdentity).href === new URL(sourceIdentity).href
    : originIdentity === sourceIdentity;
}
