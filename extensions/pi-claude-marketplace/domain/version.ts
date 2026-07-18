// domain/version.ts
//
// PI-7 hash-version computation per D-11 + D-12.
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
//   - The snapshot test in tests/domain/version.test.ts pins the expected
//     hash for a fixture tree.

import { createHash, type Hash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** D-12: walk filter -- entries by name that are skipped at every level. */
export const HASH_WALK_SKIP = Object.freeze([".git", "node_modules", ".DS_Store"] as const);

const HASH_TRUNC = 12;

/** Compute the PI-7 hash-version string for a plugin root directory. */
export async function computeHashVersion(pluginRoot: string): Promise<string> {
  const hash = createHash("sha256");
  await walkAndHash(hash, pluginRoot, "");
  return "hash-" + hash.digest("hex").slice(0, HASH_TRUNC);
}

/**
 * D-77-01 / PURL-09: anchored-exact predicate for a git-source sha-version
 * string. Matches EXACTLY `sha-` + 12 lowercase-hex chars -- the shape produced
 * by `shaVersion` (`"sha-" + fullSha.slice(0, 12)`). Uppercase hex, wrong
 * length, a `hash-` prefix, or an affixed character are all rejected so a
 * malformed pseudo-sha is never silently rewritten into a misleading short SHA
 * (mirrors the HASH_VERSION_RE hardening in shared/notify.ts).
 */
export const SHA_VERSION_RE = /^sha-[0-9a-f]{12}$/;

/**
 * D-77-01 / PURL-09: build the git-source version string from a resolved commit
 * sha -- `sha-` + the first 12 hex chars. Parallels the PI-7 `hash-<12hex>`
 * convention but names the git-commit provenance. The full 40-hex sha is
 * persisted separately (D-77-02); this string is display-and-equality level.
 */
export function shaVersion(fullSha: string): string {
  return "sha-" + fullSha.slice(0, HASH_TRUNC);
}

/** D-77-01 / PURL-09: true iff `v` is exactly `sha-<12 lowercase hex>`. */
export function looksLikeShaVersion(v: string): boolean {
  return SHA_VERSION_RE.test(v);
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
      await walkAndHash(hash, root, childRel);
    } else if (entry.isFile()) {
      // Use OS-aware joiner for the actual filesystem read.
      const buf = await readFile(path.join(root, childRel));
      hash.update(normalizeBytes(buf));
    }
    // Symlinks (entry.isSymbolicLink()) intentionally skipped per PI-7.
  }
}

/**
 * D-11: normalize file bytes before hashing.
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
    const byte = stripped[i];

    // Skip the \r in any \r\n pair; preserve standalone \r (matches git
    // behavior: autocrlf=input collapses \r\n only, leaves bare \r alone).
    if (byte === 0x0d && stripped[i + 1] === 0x0a) {
      continue;
    }

    if (byte === undefined) {
      // Unreachable: i < stripped.length, but the type system needs the guard.
      continue;
    }

    out[j++] = byte;
  }

  return out.subarray(0, j);
}
