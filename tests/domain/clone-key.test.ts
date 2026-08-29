import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canonicalCloneUrl,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";

describe("pluginCloneKey", () => {
  test("returns the same clone key for identical URL and SHA inputs", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = [
      pluginCloneKey(canonicalUrl, fullSha),
      pluginCloneKey(canonicalUrl, fullSha),
    ];

    // assert
    assert.deepStrictEqual(cloneKeys, ["97393e7e6b5a-a1b2c3d4e5f6", "97393e7e6b5a-a1b2c3d4e5f6"]);
  });

  test("changes the URL half after a one-character canonical URL change", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const adjacentCanonicalUrl = "https://github.com/o/s";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = {
      canonical: pluginCloneKey(canonicalUrl, fullSha),
      adjacent: pluginCloneKey(adjacentCanonicalUrl, fullSha),
    };

    // assert
    assert.deepStrictEqual(cloneKeys, {
      canonical: "97393e7e6b5a-a1b2c3d4e5f6",
      adjacent: "360941761bef-a1b2c3d4e5f6",
    });
  });

  test("changes the SHA half after a one-character resolved commit change", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const adjacentFullSha = "a1b2c3d4e5f7a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = {
      canonical: pluginCloneKey(canonicalUrl, fullSha),
      adjacent: pluginCloneKey(canonicalUrl, adjacentFullSha),
    };

    // assert
    assert.deepStrictEqual(cloneKeys, {
      canonical: "97393e7e6b5a-a1b2c3d4e5f6",
      adjacent: "97393e7e6b5a-a1b2c3d4e5f7",
    });
  });

  test("hashes the caller's URL verbatim", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r.git";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKey = pluginCloneKey(canonicalUrl, fullSha);

    // assert
    assert.strictEqual(cloneKey, "bc3fbd4dd8db-a1b2c3d4e5f6");
  });
});

describe("pluginMirrorKey", () => {
  test("returns the same mirror key for an identical URL", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";

    // act
    const mirrorKeys = [pluginMirrorKey(canonicalUrl), pluginMirrorKey(canonicalUrl)];

    // assert
    assert.deepStrictEqual(mirrorKeys, ["97393e7e6b5a", "97393e7e6b5a"]);
  });

  test("changes after a one-character canonical URL change", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const adjacentCanonicalUrl = "https://github.com/o/s";

    // act
    const mirrorKeys = {
      canonical: pluginMirrorKey(canonicalUrl),
      adjacent: pluginMirrorKey(adjacentCanonicalUrl),
    };

    // assert
    assert.deepStrictEqual(mirrorKeys, {
      canonical: "97393e7e6b5a",
      adjacent: "360941761bef",
    });
  });

  test("hashes the caller's URL verbatim", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r.git";

    // act
    const mirrorKey = pluginMirrorKey(canonicalUrl);

    // assert
    assert.strictEqual(mirrorKey, "bc3fbd4dd8db");
  });
});

describe("canonicalCloneUrl", () => {
  test("builds a GitHub repository URL", () => {
    // arrange
    const source = {
      kind: "github",
      raw: "o/r",
      owner: "o",
      repo: "r",
    } as const;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://github.com/o/r");
  });

  test("returns a URL source without changing it", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
    } as const;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.com/acme/mp");
  });

  test("returns a git-subdir repository root without its plugin path", () => {
    // arrange
    const source = {
      kind: "git-subdir",
      raw: "https://example.com/mono",
      url: "https://example.com/mono",
      path: "plugins/p",
    } as const;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://example.com/mono");
  });
});
