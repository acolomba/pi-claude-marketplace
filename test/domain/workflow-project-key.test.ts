import assert from "node:assert/strict";
import { test } from "node:test";

import { workflowProjectKey } from "../../extensions/pi-claude-marketplace/domain/workflow-project-key.ts";

/**
 * WPTH-03 -- byte parity with the host workflow engine's private per-project
 * key derivation.
 *
 * The engine publishes no contract for that derivation, so nothing in our code
 * or in the engine's would notice a drift; a user would notice only as
 * workflows that install successfully and never appear, because the engine
 * reads a directory we stopped writing. These expectations are the alarm.
 *
 * Every expected key here is a measured literal, transcribed from the engine's
 * own output. None is produced by calling the function under test: a re-derived
 * expectation agrees with any implementation, including a wrong one, and turns
 * an upstream-drift alarm into a tautology. A red row means upstream moved --
 * investigate the engine before touching the expectation.
 */

interface KeyCase {
  readonly name: string;
  readonly cwd: string;
  readonly expectedKey: string;
}

const KEY_CASES: readonly KeyCase[] = [
  {
    name: "joins a lowercased basename slug to twelve hex digits of the path hash",
    cwd: "/home/acolomba/some-project",
    expectedKey: "some-project-e4c31526a114",
  },
  {
    name: "lowercases a mixed-case basename",
    cwd: "/home/acolomba/UPPER-Case-Name",
    expectedKey: "upper-case-name-68af6a471604",
  },
  {
    name: "collapses each run of disallowed characters to one dash and strips the trailing one",
    cwd: "/home/acolomba/name with spaces & symbols!",
    expectedKey: "name-with-spaces-symbols-0dd0a90eb124",
  },
  {
    name: "falls back to the literal word when a Cyrillic basename sanitizes away to nothing",
    cwd: "/home/acolomba/проект",
    expectedKey: "project-cd4339b8af82",
  },
  {
    // Same fallback slug as the Cyrillic row, different key: the hash covers
    // the resolved path rather than the slug, so the two do not collide.
    name: "hashes the path rather than the slug, so a second sanitized-away basename differs",
    cwd: "/home/acolomba/日本語プロジェクト",
    expectedKey: "project-3cc7d84ca611",
  },
  {
    name: "strips leading and trailing dashes from the slug",
    cwd: "/home/acolomba/---leading-and-trailing---",
    expectedKey: "leading-and-trailing-adab370c9067",
  },
  {
    // Built with repeat() rather than pasted: a miscounted wall of characters
    // fails as a hash mismatch, which reads exactly like upstream drift.
    name: "truncates a slug longer than forty-eight characters",
    cwd: "/home/acolomba/" + "a".repeat(60),
    expectedKey: "a".repeat(48) + "-243d40bfeca2",
  },
  {
    // The dash strip runs BEFORE the 48-character slice, so truncation can
    // reintroduce a trailing dash the strip already removed -- and that dash
    // then meets the one joining the slug to the hash. Slicing first would
    // strip it and yield a single dash here, which is what makes this the only
    // row that witnesses the ordering.
    name: "keeps a dash truncation reintroduces, because the strip runs before the slice",
    cwd: "/home/acolomba/" + "a".repeat(47) + "-b",
    expectedKey: "a".repeat(47) + "--79e41bdb3cef",
  },
  {
    name: "keeps a leading dot, which is inside the allowed character class",
    cwd: "/home/acolomba/.hidden",
    expectedKey: ".hidden-c67d01a972fa",
  },
  {
    name: "keeps interior dots",
    cwd: "/home/acolomba/dots.in.name",
    expectedKey: "dots.in.name-a7042d00116c",
  },
  {
    // Half the standing proof that no path separator can survive into the key:
    // the root's basename is empty, so the fallback fires rather than a slug
    // carrying a separator.
    name: "falls back to the literal word for the filesystem root, whose basename is empty",
    cwd: "/",
    expectedKey: "project-8a5edab28263",
  },
  {
    name: "ignores a trailing separator",
    cwd: "/home/acolomba/trailing/",
    expectedKey: "trailing-0a1fd85765a9",
  },
  {
    // The other half of that proof: a `..` segment normalizes away instead of
    // reaching the slug, so this key is identical to the plain absolute
    // spelling of the same directory.
    name: "normalizes a `..` segment away before taking the basename",
    cwd: "/home/acolomba/../acolomba/some-project",
    expectedKey: "some-project-e4c31526a114",
  },
];

for (const { name, cwd, expectedKey } of KEY_CASES) {
  test(name, () => {
    // arrange
    const projectCwd = cwd;

    // act
    const projectKey = workflowProjectKey(projectCwd);

    // assert
    assert.strictEqual(projectKey, expectedKey);
  });
}

test("collapses two spellings of one project onto a single key", () => {
  // arrange
  const canonicalCwd = "/home/acolomba/some-project";
  const nonNormalizedCwd = "/home/acolomba/../acolomba/some-project";

  // act
  const projectKeys = {
    canonical: workflowProjectKey(canonicalCwd),
    nonNormalized: workflowProjectKey(nonNormalizedCwd),
  };

  // assert
  assert.deepStrictEqual(projectKeys, {
    canonical: "some-project-e4c31526a114",
    nonNormalized: "some-project-e4c31526a114",
  });
});

test("resolves a relative spelling against the working directory before taking the basename", (t) => {
  // arrange
  // The hash covers the RESOLVED path, so a literal expectation is only
  // deterministic once the working directory is pinned. Moving the process to
  // the filesystem root makes this relative spelling resolve onto exactly the
  // absolute path the canonical row above uses, and its key is that row's key.
  // Do not remove the chdir: without it this expectation holds only on the
  // machine that recorded it.
  const previousCwd = process.cwd();

  t.after(() => {
    process.chdir(previousCwd);
  });
  process.chdir("/");

  // act
  const projectKey = workflowProjectKey("home/acolomba/some-project");

  // assert
  assert.strictEqual(projectKey, "some-project-e4c31526a114");
});
