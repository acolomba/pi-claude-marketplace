import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  RELEASE_TAG_SEPARATOR,
  selectHighestSatisfyingTag,
} from "../../extensions/pi-claude-marketplace/domain/release-tag.ts";

import type { ReleaseTagCandidate } from "../../extensions/pi-claude-marketplace/domain/release-tag.ts";

describe("selectHighestSatisfyingTag", () => {
  test("picks the highest satisfying candidate among several this plugin's own", () => {
    // arrange
    const candidates: readonly ReleaseTagCandidate[] = [
      { name: "formatter--v1.0.0", oid: "a" },
      { name: "formatter--v2.1.0", oid: "b" },
      { name: "formatter--v3.0.0", oid: "c" },
    ];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "^2.0.0",
    );

    // assert
    assert.deepStrictEqual(selected, {
      kind: "pinned",
      tag: "formatter--v2.1.0",
      oid: "b",
      version: "2.1.0",
    });
  });

  test("a candidate named for a different plugin is never selected, whatever version it carries", () => {
    // arrange
    const candidates: readonly ReleaseTagCandidate[] = [{ name: "linter--v9.9.9", oid: "z" }];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "*",
    );

    // assert
    assert.deepStrictEqual(selected, { kind: "no-matching-tag", range: "*" });
  });

  test("a candidate whose remainder after the prefix is not valid semver is skipped, not an error", () => {
    // arrange
    const candidates: readonly ReleaseTagCandidate[] = [
      { name: "formatter--vLATEST", oid: "bad" },
      { name: "formatter--v1.0.0", oid: "good" },
    ];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "^1.0.0",
    );

    // assert
    assert.deepStrictEqual(selected, {
      kind: "pinned",
      tag: "formatter--v1.0.0",
      oid: "good",
      version: "1.0.0",
    });
  });

  test("a later, lower-versioned satisfying candidate never displaces an already-selected higher one", () => {
    // arrange: order matters for this branch -- the higher version must be
    // selected FIRST, so the later comparison exercises `gt() === false`
    // rather than always widening to a new highest. Both versions stay
    // within `^2.0.0` (>=2.0.0 <3.0.0), unlike 3.0.0 which the range excludes.
    const candidates: readonly ReleaseTagCandidate[] = [
      { name: "formatter--v2.5.0", oid: "c" },
      { name: "formatter--v2.1.0", oid: "b" },
    ];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "^2.0.0",
    );

    // assert
    assert.deepStrictEqual(selected, {
      kind: "pinned",
      tag: "formatter--v2.5.0",
      oid: "c",
      version: "2.5.0",
    });
  });

  test("an empty candidate list yields the no-match arm carrying the rendered range", () => {
    // act
    const selected = selectHighestSatisfyingTag([], `formatter${RELEASE_TAG_SEPARATOR}`, "^1.0.0");

    // assert
    assert.deepStrictEqual(selected, { kind: "no-matching-tag", range: "^1.0.0" });
  });

  test("a candidate whose name does not carry the plugin's own prefix is not a candidate", () => {
    // arrange
    const candidates: readonly ReleaseTagCandidate[] = [{ name: "other--v1.0.0", oid: "x" }];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "*",
    );

    // assert
    assert.deepStrictEqual(selected, { kind: "no-matching-tag", range: "*" });
  });

  test("a candidate whose version does not satisfy the range is not a candidate", () => {
    // arrange
    const candidates: readonly ReleaseTagCandidate[] = [{ name: "formatter--v1.0.0", oid: "x" }];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "^2.0.0",
    );

    // assert
    assert.deepStrictEqual(selected, { kind: "no-matching-tag", range: "^2.0.0" });
  });

  test("prefix matching is case-sensitive with no Unicode normalization", () => {
    // arrange: a name differing only by case is not the same prefix -- the
    // identical comparison the remote probe performs
    // (String.prototype.startsWith).
    const candidates: readonly ReleaseTagCandidate[] = [{ name: "Formatter--v1.0.0", oid: "x" }];

    // act
    const selected = selectHighestSatisfyingTag(
      candidates,
      `formatter${RELEASE_TAG_SEPARATOR}`,
      "*",
    );

    // assert
    assert.deepStrictEqual(selected, { kind: "no-matching-tag", range: "*" });
  });
});
