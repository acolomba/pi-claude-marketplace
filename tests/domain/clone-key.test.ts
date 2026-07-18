// PURL-04 / D-77-04 source-addressed cache-key tests.
//
// `pluginCloneKey(canonicalUrl, fullSha)` derives a fixed-length,
// filesystem-safe key `<12hex(sha256(canonicalUrl))>-<sha12>`. The key is the
// single dedup identity shared by the clone seam and install: two differently
// named plugins pointing at the same canonical url+sha share one clone.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  canonicalCloneUrl,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";

const URL_A = "https://github.com/o/r";
const URL_B = "https://github.com/o/other";
const SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

function expectedLeft(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 12);
}

test("PURL-04 pluginCloneKey returns <12hex>-<sha12> with the sha256(url) left half", () => {
  const key = pluginCloneKey(URL_A, SHA);
  assert.equal(key.length, 25);
  assert.equal(key, `${expectedLeft(URL_A)}-${SHA.slice(0, 12)}`);
});

test("PURL-04 pluginCloneKey is deterministic across calls", () => {
  assert.equal(pluginCloneKey(URL_A, SHA), pluginCloneKey(URL_A, SHA));
});

test("PURL-04 / D-77-04 different canonical urls produce different left halves", () => {
  const a = pluginCloneKey(URL_A, SHA);
  const b = pluginCloneKey(URL_B, SHA);
  assert.notEqual(a, b);
  // Same url + same sha -> identical key (cross-shape dedup foundation).
  assert.equal(pluginCloneKey(URL_A, SHA), pluginCloneKey(URL_A, SHA));
});

test("PURL-04 pluginCloneKey is filesystem-safe: no separators, matches the fixed shape", () => {
  const key = pluginCloneKey(URL_A, SHA);
  assert.doesNotMatch(key, /[/\\]/);
  assert.match(key, /^[0-9a-f]{12}-[0-9a-f]{12}$/);
});

test("MIRR-01 pluginMirrorKey returns a bare 12-hex key with no sha suffix", () => {
  const key = pluginMirrorKey(URL_A);
  assert.match(key, /^[0-9a-f]{12}$/);
  assert.doesNotMatch(key, /-/);
});

test("MIRR-01 pluginMirrorKey equals the sha256(url) left half of pluginCloneKey", () => {
  assert.equal(pluginMirrorKey(URL_A), expectedLeft(URL_A));
  assert.ok(pluginCloneKey(URL_A, SHA).startsWith(pluginMirrorKey(URL_A) + "-"));
});

test("MIRR-01 pluginMirrorKey is deterministic and URL-sensitive", () => {
  assert.equal(pluginMirrorKey(URL_A), pluginMirrorKey(URL_A));
  assert.notEqual(pluginMirrorKey(URL_A), pluginMirrorKey(URL_B));
});

// D-77-06 / PURL-07: canonicalCloneUrl is the single url reconstruction both
// key halves hash over -- the clone seam and the fs-only presence probe import
// THIS function, so the exact strings below are the clone-key identity
// contract per source kind.
test("D-77-06 canonicalCloneUrl pins the canonical clone url for each git source kind", () => {
  assert.equal(
    canonicalCloneUrl({ kind: "github", raw: "o/r", owner: "o", repo: "r" }),
    "https://github.com/o/r",
  );
  assert.equal(
    canonicalCloneUrl({
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
    }),
    "https://gitlab.com/acme/mp",
    "url kind returns the parse-time canonical source.url verbatim",
  );
  assert.equal(
    canonicalCloneUrl({
      kind: "git-subdir",
      raw: "https://example.com/mono",
      url: "https://example.com/mono",
      path: "plugins/p",
    }),
    "https://example.com/mono",
    "git-subdir clone url is the repo root; the subdir path never participates",
  );
});
