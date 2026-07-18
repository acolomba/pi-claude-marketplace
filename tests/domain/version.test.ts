// PI-7 hash-version contract tests. The snapshot value pinned in
// `PI-7 SNAPSHOT` freezes the algorithm + truncation length (12 hex chars)
// + walk filter list as a stable user contract per D-11/D-12.
// Any future change to the algorithm, truncation length, normalization
// rules, or HASH_WALK_SKIP list MUST be accompanied by a CHANGELOG entry.
//
// `.git/HEAD` is materialized at test-startup (not committed to git --
// git refuses to track any file under a `.git` path component). The file
// MUST exist on disk before the snapshot test runs so the walk-filter
// exclusion is exercised against a real `.git/` entry, exactly the way a
// freshly-cloned plugin tree would present.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { before } from "node:test";
import { fileURLToPath } from "node:url";

import {
  computeHashVersion,
  HASH_WALK_SKIP,
  looksLikeShaVersion,
  SHA_VERSION_RE,
  shaVersion,
} from "../../extensions/pi-claude-marketplace/domain/version.ts";
import { renderVersion } from "../../extensions/pi-claude-marketplace/shared/notify.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, "fixtures/hash-stability");
const SAMPLE_PLUGIN = path.join(FIXTURE_ROOT, "sample-plugin");
const SAMPLE_PLUGIN_DOT_GIT = path.join(SAMPLE_PLUGIN, ".git");
const SAMPLE_PLUGIN_DOT_GIT_HEAD = path.join(SAMPLE_PLUGIN_DOT_GIT, "HEAD");

before(() => {
  // PI-7 / D-12: re-create the `.git/HEAD` decoy on every run. Git itself
  // will not let us check this file into the repo (any path containing a
  // `.git` component is silently refused), so we materialize it at test
  // startup. Its presence exercises the HASH_WALK_SKIP filter -- if the
  // walker did NOT skip `.git/`, the snapshot hash would change.
  mkdirSync(SAMPLE_PLUGIN_DOT_GIT, { recursive: true });
  writeFileSync(SAMPLE_PLUGIN_DOT_GIT_HEAD, "ref: refs/heads/main\n");
});

test("PI-7 / D-12 HASH_WALK_SKIP is the locked walk-filter list", () => {
  // D-12 contract: exactly these three entries, in this order. Adding or
  // removing entries is a breaking change to the user-visible hash version.
  assert.deepEqual([...HASH_WALK_SKIP], [".git", "node_modules", ".DS_Store"]);
});

test("PI-7 computeHashVersion returns 12-hex prefix matching /^hash-[0-9a-f]{12}$/", async () => {
  const got = await computeHashVersion(SAMPLE_PLUGIN);
  assert.match(got, /^hash-[0-9a-f]{12}$/);
});

test("PI-7 / D-11 computeHashVersion is invariant across CRLF<->LF + BOM<->no-BOM", async () => {
  // D-11 normalization: byte-different but logically-equivalent files
  // (UTF-8 BOM stripped, CRLF collapsed to LF) MUST produce the same hash.
  const lf = await computeHashVersion(path.join(FIXTURE_ROOT, "sample-lf"));
  const crlfBom = await computeHashVersion(path.join(FIXTURE_ROOT, "sample-crlf-bom"));
  assert.equal(lf, crlfBom, `LF hash ${lf} should equal CRLF+BOM hash ${crlfBom}`);
});

test("PI-7 / D-12 computeHashVersion is stable across runs (deterministic, same input -> same hash)", async () => {
  const a = await computeHashVersion(SAMPLE_PLUGIN);
  const b = await computeHashVersion(SAMPLE_PLUGIN);
  assert.equal(a, b);
});

test("PI-7 SNAPSHOT: sample-plugin fixture hash is pinned (D-11/D-12 contract)", async () => {
  // The pinned value below is the SHA-256 of (sorted-walk path bytes +
  // normalized file bytes) over the sample-plugin tree, truncated to 12
  // hex chars and prefixed `hash-`. The walk excludes `.git/` and
  // `.DS_Store` per HASH_WALK_SKIP -- adding/removing those decoys does
  // NOT change the hash. Re-pinning this value MUST be accompanied by a
  // CHANGELOG entry per PI-7.
  const got = await computeHashVersion(SAMPLE_PLUGIN);
  assert.equal(
    got,
    "hash-743f35130ec4",
    `Snapshot mismatch -- got ${got}. If the algorithm/truncation/walk-filter changed intentionally, update the pinned snapshot value in tests/domain/version.test.ts and add a CHANGELOG entry per the PI-7 contract.`,
  );
});

// PURL-09 / D-77-01 sha-version helper contract. Parallels the PI-7
// hash-version convention: `sha-<12hex>` names the git-commit provenance,
// stays compact on the list surface, and compares by exact string equality.

const FULL_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

test("PURL-09 / D-77-01 shaVersion returns sha- + first 12 hex of the full sha", () => {
  assert.equal(shaVersion(FULL_SHA), "sha-a1b2c3d4e5f6");
});

test("PURL-09 / D-77-01 SHA_VERSION_RE is the anchored-exact 12-lowercase-hex shape", () => {
  assert.deepEqual(SHA_VERSION_RE, /^sha-[0-9a-f]{12}$/);
});

test("PURL-09 / D-77-01 looksLikeShaVersion accepts exactly sha-<12 lowercase hex>", () => {
  assert.equal(looksLikeShaVersion("sha-a1b2c3d4e5f6"), true);
});

test("PURL-09 / D-77-01 looksLikeShaVersion rejects uppercase, wrong length, hash-, and semver", () => {
  assert.equal(looksLikeShaVersion("sha-A1B2C3D4E5F6"), false);
  assert.equal(looksLikeShaVersion("sha-a1b2"), false);
  assert.equal(looksLikeShaVersion("hash-a1b2c3d4e5f6"), false);
  assert.equal(looksLikeShaVersion("1.0.0"), false);
});

test("PURL-09 / D-77-01 renderVersion renders sha-<12hex> as v#<first 7 hex>", () => {
  assert.equal(renderVersion("sha-2ea95f857031"), "v#2ea95f8");
});

test("PURL-09 / D-77-01 renderVersion leaves hash-<12hex> and SemVer unchanged", () => {
  // The hash arm is unaffected by the sha arm (each formatter no-ops the
  // other's shape); SemVer passes straight through.
  assert.equal(renderVersion("hash-2ea95f85703d"), "v#2ea95f8");
  assert.equal(renderVersion("1.0.0"), "v1.0.0");
});
