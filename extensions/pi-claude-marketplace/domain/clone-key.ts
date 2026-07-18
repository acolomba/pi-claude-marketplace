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
 *   - url / git-subdir: `source.url` verbatim -- the parser already produced
 *     the parse-time canonical form (`.git`-stripped, `#ref`-split, D-76-01),
 *     so dedup is `.git`-suffix-insensitive. For git-subdir the clone url is
 *     the repo root; the subdir path is resolved later by the resolver
 *     (git-subdir pluginRoot = cloneRoot + path).
 */
export function canonicalCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  return source.kind === "github"
    ? `https://github.com/${source.owner}/${source.repo}`
    : source.url;
}
