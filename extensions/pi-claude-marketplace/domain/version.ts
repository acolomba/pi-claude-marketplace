// domain/version.ts
//
// PI-7 hash-version computation per D-v1.0-02-11 + D-12.
//
// Algorithm:
//   1. Walk pluginRoot recursively, skipping HASH_WALK_SKIP entries.
//   2. Sort entries at each directory level by name (deterministic order).
//   3. For each entry, hash the POSIX-style relative path bytes.
//   4. For files, also hash the normalized content bytes (CRLF -> LF + BOM strip).
//   5. Symlinks are skipped entirely (PI-7: targets MUST NOT be included).
//   6. Return SHA-256 truncated to 12 hex chars, prefixed `hash-`.
//
// Stability contract (PI-7):
//   - The algorithm, the truncation length (12), AND the walk filter list
//     are part of the stable user contract. Any change requires a
//     CHANGELOG entry.
//   - The snapshot test in test/domain/version.test.ts pins the expected
//     hash for a fixture tree.

import { createHash, type Hash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ParsedSource } from "./source.ts";

/** D-12: walk filter -- entries by name that are skipped at every level. */
const HASH_WALK_SKIP = Object.freeze([".git", "node_modules", ".DS_Store"] as const);

const HASH_TRUNC = 12;

const SUBDIR_HASH_TRUNC = 8;

/** GV-01: Claude Code's plugin directory, whose pinned plugins carry the pin in their version. */
const PLUGIN_DIRECTORY_MARKETPLACE = "anthropic-plugin-directory";

/** GV-02: the git-source version a record written before GV-01 holds. */
const LEGACY_SHA_VERSION_RE = /^sha-([0-9a-f]{12})$/;

/** GV-01: a git-source version derived from a commit, as Claude Code's own check reads one. */
const SHA_VERSION_RE = /^([0-9a-f]{12})(?:-[0-9a-f]{8})?$/;

/** Compute the PI-7 hash-version string for a plugin root directory. */
export async function computeHashVersion(pluginRoot: string): Promise<string> {
  const hash = createHash("sha256");
  await walkAndHash(hash, pluginRoot, "");
  return "hash-" + hash.digest("hex").slice(0, HASH_TRUNC);
}

/**
 * GV-01: the version Claude Code records for a git source that declares none --
 * the first 12 characters of the installed commit, and for a `git-subdir`
 * source a `-` and the first 8 hex characters of the SHA-256 of its
 * subdirectory path. Claude Code normalizes that path first: backslashes become
 * slashes, one leading `./` and every trailing `/` are dropped. The full sha is
 * recorded apart (D-77-02).
 */
export function shaVersion(fullSha: string, source: ParsedSource): string {
  return commitVersion(fullSha, source.kind === "git-subdir" ? source.path : undefined);
}

/**
 * GV-01: the version Claude Code records for a plugin that declares none and
 * installs at the release tag a dependency's version range selected:
 * `shaVersion` of the tag's commit. A `path` source installs at a tag of its
 * marketplace's repository, and Claude Code reads it as a `git-subdir` source
 * of that repository: its path loses one leading `./` (or is a lone `.`), and
 * a path left empty names the repository root, which hashes no path.
 */
export function tagShaVersion(tagCommit: string, source: ParsedSource): string {
  if (source.kind !== "path") {
    return shaVersion(tagCommit, source);
  }

  const subdir = source.raw.replace(/^\.(?:\/|$)/, "");
  return commitVersion(tagCommit, subdir === "" ? undefined : subdir);
}

/** A commit's 12 characters, with the hash of a subdirectory path when there is one. */
function commitVersion(fullSha: string, subdirPath: string | undefined): string {
  const commit = fullSha.slice(0, HASH_TRUNC);
  if (subdirPath === undefined) {
    return commit;
  }

  let subdir = subdirPath.replaceAll("\\", "/").replace(/^\.\//, "");
  while (subdir.endsWith("/")) {
    subdir = subdir.slice(0, -1);
  }

  return `${commit}-${createHash("sha256").update(subdir).digest("hex").slice(0, SUBDIR_HASH_TRUNC)}`;
}

/**
 * GV-01: the version Claude Code records for a plugin that declares one and
 * installs at the release tag a dependency's version range selected: `-` and
 * the first 12 characters of the tag's commit appended, once.
 */
export function withTagCommit(version: string, tagCommit: string): string {
  const suffix = `-${tagCommit.slice(0, HASH_TRUNC)}`;
  return version.endsWith(suffix) ? version : `${version}${suffix}`;
}

/**
 * GV-01: a declared version as Claude Code records it. A plugin of the
 * `anthropic-plugin-directory` marketplace whose source is pinned to a commit
 * carries a `-` and the pin's first 12 characters, once.
 */
export function declaredVersionWithPin(
  declared: string,
  source: ParsedSource,
  marketplaceName: string,
): string {
  const pin = sourcePin(source);
  if (marketplaceName !== PLUGIN_DIRECTORY_MARKETPLACE || pin === undefined) {
    return declared;
  }

  return withTagCommit(declared, pin);
}

/** The commit a git source is pinned to; other sources carry no pin. */
function sourcePin(source: ParsedSource): string | undefined {
  switch (source.kind) {
    case "github":
    case "url":
    case "git-subdir":
      return source.sha;
    case "path":
    case "npm":
    case "unknown":
      return undefined;
  }
}

/**
 * GV-02: whether a recorded version is the candidate's. A record written
 * before GV-01 holds `sha-<12hex>` where the same commit now derives
 * `<12hex>` (or `<12hex>-<8hex>` for a `git-subdir` source); both name one
 * commit, so the old form is the same version and an update moves nothing.
 *
 * GV-01: a record installed at a release tag holds the candidate's declared
 * version with its commit appended (`withTagCommit`), which names the same
 * version when `recordedCommit`, the commit the record holds, is that commit.
 */
export function isSameVersion(
  recorded: string,
  candidate: string,
  recordedCommit?: string,
): boolean {
  if (
    recorded === candidate ||
    (recordedCommit !== undefined && recorded === withTagCommit(candidate, recordedCommit))
  ) {
    return true;
  }

  const legacyCommit = LEGACY_SHA_VERSION_RE.exec(recorded)?.[1];
  return legacyCommit !== undefined && SHA_VERSION_RE.exec(candidate)?.[1] === legacyCommit;
}

async function walkAndHash(hash: Hash, root: string, rel: string): Promise<void> {
  const dirAbs = rel === "" ? root : path.join(root, rel);
  const entries = await readdir(dirAbs, { withFileTypes: true });
  // Filter and sort -- deterministic order at every level (PI-7).
  const filtered = entries
    .filter((e) => !(HASH_WALK_SKIP as readonly string[]).includes(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of filtered) {
    // Posix joiner for the path-bytes argument so the hash is identical on
    // Windows and POSIX. Note: path.join (OS-aware) is used separately for
    // the actual fs read on the next line.
    const childRel = path.posix.join(rel, entry.name);
    hash.update(childRel);

    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- PI-7: the hash digests entries in sorted order
      await walkAndHash(hash, root, childRel);
    } else if (entry.isFile()) {
      // Use OS-aware joiner for the actual filesystem read.
      // eslint-disable-next-line no-await-in-loop -- PI-7: the hash digests entries in sorted order
      const buf = await readFile(path.join(root, childRel));
      hash.update(normalizeBytes(buf));
    }
    // Symlinks (entry.isSymbolicLink()) intentionally skipped per PI-7.
  }
}

/**
 * D-v1.0-02-11: normalize file bytes before hashing.
 *   1. Strip leading UTF-8 BOM (\xEF\xBB\xBF).
 *   2. Collapse \r\n -> \n (matches git autocrlf=input behavior).
 *
 * Returns a new Buffer; does not mutate input.
 */
function normalizeBytes(buf: Buffer): Buffer {
  // Strip leading BOM if present
  const stripped =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      ? buf.subarray(3)
      : buf;

  // Fast path: no CR present
  if (!stripped.includes(0x0d)) {
    return stripped;
  }

  const out = Buffer.alloc(stripped.length);
  let j = 0;

  for (let i = 0; i < stripped.length; i++) {
    const byte = stripped.readUInt8(i);

    // Skip the \r in any \r\n pair; preserve standalone \r (matches git
    // behavior: autocrlf=input collapses \r\n only, leaves bare \r alone).
    if (byte === 0x0d && stripped[i + 1] === 0x0a) {
      continue;
    }

    out[j++] = byte;
  }

  return out.subarray(0, j);
}
