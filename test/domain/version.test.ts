import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  computeHashVersion,
  declaredVersionWithPin,
  isPluginDirectoryMarketplace,
  isSameVersion,
  shaVersion,
  tagShaVersion,
  withoutTagCommit,
  withTagCommit,
} from "../../extensions/pi-claude-marketplace/domain/version.ts";

import type { ParsedSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";

async function createVersionSandbox(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-version-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });
  return directory;
}

describe("computeHashVersion", () => {
  test("returns the fixed empty-tree hash", async (t) => {
    // arrange
    const pluginRoot = await createVersionSandbox(t);

    // act
    const version = await computeHashVersion(pluginRoot);

    // assert
    assert.strictEqual(version, "hash-e3b0c44298fc");
  });

  test("returns one hash for opposite filesystem insertion orders", async (t) => {
    // arrange
    const directory = await createVersionSandbox(t);
    const forwardPluginRoot = path.join(directory, "forward");
    const reversePluginRoot = path.join(directory, "reverse");
    await mkdir(forwardPluginRoot);
    await writeFile(path.join(forwardPluginRoot, "a.txt"), "alpha\n");
    await mkdir(path.join(forwardPluginRoot, "nested"));
    await writeFile(path.join(forwardPluginRoot, "nested", "a.txt"), "inner-a\n");
    await writeFile(path.join(forwardPluginRoot, "nested", "b.txt"), "inner-b\n");
    await writeFile(path.join(forwardPluginRoot, "z.txt"), "zulu\n");
    await mkdir(reversePluginRoot);
    await writeFile(path.join(reversePluginRoot, "z.txt"), "zulu\n");
    await mkdir(path.join(reversePluginRoot, "nested"));
    await writeFile(path.join(reversePluginRoot, "nested", "b.txt"), "inner-b\n");
    await writeFile(path.join(reversePluginRoot, "nested", "a.txt"), "inner-a\n");
    await writeFile(path.join(reversePluginRoot, "a.txt"), "alpha\n");

    // act
    const forwardVersion = await computeHashVersion(forwardPluginRoot);
    const reverseVersion = await computeHashVersion(reversePluginRoot);

    // assert
    assert.strictEqual(forwardVersion, "hash-6e4d4d577c91");
    assert.strictEqual(reverseVersion, "hash-6e4d4d577c91");
  });

  test("hashes equal content by sorted path and changed bytes", async (t) => {
    // arrange
    const pluginRoot = await createVersionSandbox(t);
    await writeFile(path.join(pluginRoot, "a.txt"), "same\n");
    await writeFile(path.join(pluginRoot, "b.txt"), "same\n");

    // act
    const equalContentVersion = await computeHashVersion(pluginRoot);
    await writeFile(path.join(pluginRoot, "b.txt"), "same!\n");
    const changedContentVersion = await computeHashVersion(pluginRoot);

    // assert
    assert.strictEqual(equalContentVersion, "hash-73ef760ab281");
    assert.strictEqual(changedContentVersion, "hash-3bc00f0d259c");
  });

  test("hashes sorted nested paths and normalized bytes deterministically", async (t) => {
    // arrange
    const pluginRoot = await createVersionSandbox(t);
    await writeFile(path.join(pluginRoot, "z.txt"), "zulu\n");
    await mkdir(path.join(pluginRoot, "nested"));
    await writeFile(path.join(pluginRoot, "nested", "b.txt"), "beta\rstandalone\r\n");
    await writeFile(
      path.join(pluginRoot, "a.txt"),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("alpha\r\n")]),
    );
    await writeFile(path.join(pluginRoot, "short.txt"), "x");

    // act
    const version = await computeHashVersion(pluginRoot);

    // assert
    assert.strictEqual(version, "hash-7f044a9c40a0");
  });

  test("ignores Git, dependency, and Finder entry contents", async (t) => {
    // arrange
    const directory = await createVersionSandbox(t);
    const cleanPluginRoot = path.join(directory, "clean");
    const ignoredPluginRoot = path.join(directory, "ignored");
    await mkdir(cleanPluginRoot);
    await mkdir(ignoredPluginRoot);
    await writeFile(path.join(cleanPluginRoot, "main.txt"), "main\n");
    await writeFile(path.join(ignoredPluginRoot, "main.txt"), "main\n");
    await mkdir(path.join(ignoredPluginRoot, ".git"));
    await writeFile(path.join(ignoredPluginRoot, ".git", "HEAD"), "ignored\n");
    await mkdir(path.join(ignoredPluginRoot, "node_modules", "package"), {
      recursive: true,
    });
    await writeFile(
      path.join(ignoredPluginRoot, "node_modules", "package", "index.js"),
      "ignored\n",
    );
    await writeFile(path.join(ignoredPluginRoot, ".DS_Store"), "ignored\n");

    // act
    const cleanVersion = await computeHashVersion(cleanPluginRoot);
    const ignoredVersion = await computeHashVersion(ignoredPluginRoot);

    // assert
    assert.strictEqual(cleanVersion, "hash-c5994021316d");
    assert.strictEqual(ignoredVersion, "hash-c5994021316d");
  });

  test("normalizes a UTF-8 BOM and CRLF line endings", async (t) => {
    // arrange
    const directory = await createVersionSandbox(t);
    const lfPluginRoot = path.join(directory, "lf");
    const crlfPluginRoot = path.join(directory, "crlf");
    await mkdir(lfPluginRoot);
    await mkdir(crlfPluginRoot);
    await writeFile(path.join(lfPluginRoot, "plugin.txt"), "hello\n");
    await writeFile(
      path.join(crlfPluginRoot, "plugin.txt"),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("hello\r\n")]),
    );

    // act
    const lfVersion = await computeHashVersion(lfPluginRoot);
    const crlfVersion = await computeHashVersion(crlfPluginRoot);

    // assert
    assert.strictEqual(lfVersion, "hash-35fe934cd70c");
    assert.strictEqual(crlfVersion, "hash-35fe934cd70c");
  });

  test("preserves a standalone carriage return", async (t) => {
    // arrange
    const directory = await createVersionSandbox(t);
    const carriagePluginRoot = path.join(directory, "carriage");
    const linefeedPluginRoot = path.join(directory, "linefeed");
    await mkdir(carriagePluginRoot);
    await mkdir(linefeedPluginRoot);
    await writeFile(path.join(carriagePluginRoot, "plugin.txt"), "a\rb\n");
    await writeFile(path.join(linefeedPluginRoot, "plugin.txt"), "a\nb\n");

    // act
    const carriageVersion = await computeHashVersion(carriagePluginRoot);
    const linefeedVersion = await computeHashVersion(linefeedPluginRoot);

    // assert
    assert.strictEqual(carriageVersion, "hash-574e22309277");
    assert.strictEqual(linefeedVersion, "hash-e851780efdf8");
  });

  test("does not hash symlink target bytes", async (t) => {
    // arrange
    const directory = await createVersionSandbox(t);
    const pluginRoot = path.join(directory, "plugin");
    const targetPath = path.join(directory, "external.txt");
    await mkdir(pluginRoot);
    await writeFile(targetPath, "first target\n");
    await symlink(targetPath, path.join(pluginRoot, "alias.txt"));

    // act
    const firstVersion = await computeHashVersion(pluginRoot);
    await writeFile(targetPath, "different target\n");
    const secondVersion = await computeHashVersion(pluginRoot);

    // assert
    assert.strictEqual(firstVersion, "hash-e07e386a2c84");
    assert.strictEqual(secondVersion, "hash-e07e386a2c84");
  });
});

const FULL_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const PIN = "0123456789abcdef0123456789abcdef01234567";

function githubSource(sha?: string): ParsedSource {
  return {
    kind: "github",
    raw: "acme/tools",
    owner: "acme",
    repo: "tools",
    ...(sha !== undefined && { sha }),
  };
}

function subdirSource(subdir: string): ParsedSource {
  return {
    kind: "git-subdir",
    raw: "https://h/acme/mono.git",
    url: "https://h/acme/mono.git",
    path: subdir,
  };
}

describe("shaVersion", () => {
  test("GV-01: uses the first 12 characters of the resolved commit SHA", () => {
    // act
    const version = shaVersion(FULL_SHA, githubSource());

    // assert
    assert.strictEqual(version, "a1b2c3d4e5f6");
  });

  test("GV-01: appends the first 8 hex of the SHA-256 of a git-subdir path", () => {
    // act
    const version = shaVersion(FULL_SHA, subdirSource("plugins/subp"));

    // assert
    assert.strictEqual(version, "a1b2c3d4e5f6-3989e95a");
  });

  test("GV-01: normalizes the git-subdir path the way Claude Code does", () => {
    // act
    const versions = ["./plugins/subp", "plugins/subp//", "plugins\\subp"].map((subdir) =>
      shaVersion(FULL_SHA, subdirSource(subdir)),
    );

    // assert
    assert.deepStrictEqual(versions, [
      "a1b2c3d4e5f6-3989e95a",
      "a1b2c3d4e5f6-3989e95a",
      "a1b2c3d4e5f6-3989e95a",
    ]);
  });
});

function pathSource(raw: string): ParsedSource {
  return { kind: "path", raw, logical: raw };
}

describe("tagShaVersion", () => {
  test("GV-01: a git source at a release tag records the tag commit as shaVersion does", () => {
    // act
    const versions = [
      tagShaVersion(FULL_SHA, githubSource()),
      tagShaVersion(FULL_SHA, subdirSource("plugins/subp")),
    ];

    // assert
    assert.deepStrictEqual(versions, ["a1b2c3d4e5f6", "a1b2c3d4e5f6-3989e95a"]);
  });

  test("GV-01: a path source at a release tag hashes its path as a git-subdir source", () => {
    // act
    const versions = ["./plugins/subp", "plugins/subp/"].map((raw) =>
      tagShaVersion(FULL_SHA, pathSource(raw)),
    );

    // assert
    assert.deepStrictEqual(versions, ["a1b2c3d4e5f6-3989e95a", "a1b2c3d4e5f6-3989e95a"]);
  });

  test("GV-01: a path source at the repository root records the bare commit", () => {
    // act
    const versions = [".", "./"].map((raw) => tagShaVersion(FULL_SHA, pathSource(raw)));

    // assert
    assert.deepStrictEqual(versions, ["a1b2c3d4e5f6", "a1b2c3d4e5f6"]);
  });
});

describe("withTagCommit", () => {
  test("GV-01: appends a dash and the first 12 characters of the tag commit", () => {
    assert.strictEqual(withTagCommit("2.0.0", FULL_SHA), "2.0.0-a1b2c3d4e5f6");
  });

  test("GV-01: a version that already ends in the commit keeps one copy", () => {
    assert.strictEqual(withTagCommit("2.0.0-a1b2c3d4e5f6", FULL_SHA), "2.0.0-a1b2c3d4e5f6");
  });
});

describe("withoutTagCommit", () => {
  test("GV-01: drops a dash and the first 12 characters of the commit", () => {
    assert.strictEqual(withoutTagCommit("2.0.0-a1b2c3d4e5f6", FULL_SHA), "2.0.0");
  });

  test("GV-01: keeps a version that does not end in the commit", () => {
    assert.strictEqual(withoutTagCommit("2.0.0-b1b2c3d4e5f6", FULL_SHA), "2.0.0-b1b2c3d4e5f6");
  });

  test("GV-01: keeps a version that is only the suffix", () => {
    assert.strictEqual(withoutTagCommit("-a1b2c3d4e5f6", FULL_SHA), "-a1b2c3d4e5f6");
  });

  test("GV-01: keeps the version when no commit is recorded", () => {
    assert.strictEqual(withoutTagCommit("2.0.0-a1b2c3d4e5f6", undefined), "2.0.0-a1b2c3d4e5f6");
  });
});

describe("isPluginDirectoryMarketplace", () => {
  test("GV-01: names Claude Code's plugin directory and no other marketplace", () => {
    assert.deepStrictEqual(
      ["anthropic-plugin-directory", "tools", "anthropic-plugin-directory-mirror"].map((name) =>
        isPluginDirectoryMarketplace(name),
      ),
      [true, false, false],
    );
  });
});

describe("declaredVersionWithPin", () => {
  test("GV-01: a pinned plugin of the plugin directory carries its pin", () => {
    // act
    const version = declaredVersionWithPin(
      "1.0.0",
      githubSource(PIN),
      "anthropic-plugin-directory",
    );

    // assert
    assert.strictEqual(version, "1.0.0-0123456789ab");
  });

  test("GV-01: a version that already ends in the pin keeps one copy", () => {
    // act
    const version = declaredVersionWithPin(
      "1.0.0-0123456789ab",
      githubSource(PIN),
      "anthropic-plugin-directory",
    );

    // assert
    assert.strictEqual(version, "1.0.0-0123456789ab");
  });

  test("GV-01: the declared version stands for any other marketplace, an unpinned or a path source", () => {
    // act
    const versions = [
      declaredVersionWithPin("1.0.0", githubSource(PIN), "tools"),
      declaredVersionWithPin("1.0.0", githubSource(), "anthropic-plugin-directory"),
      declaredVersionWithPin(
        "1.0.0",
        { kind: "path", raw: "./p", logical: "./p" },
        "anthropic-plugin-directory",
      ),
    ];

    // assert
    assert.deepStrictEqual(versions, ["1.0.0", "1.0.0", "1.0.0"]);
  });
});

describe("isSameVersion", () => {
  test("GV-02: equal versions are the same", () => {
    assert.strictEqual(isSameVersion("1.0.0", "1.0.0"), true);
  });

  test("GV-02: a legacy sha- version is the commit version it names", () => {
    // act
    const verdicts = [
      isSameVersion("sha-a1b2c3d4e5f6", "a1b2c3d4e5f6"),
      isSameVersion("sha-a1b2c3d4e5f6", "a1b2c3d4e5f6-3989e95a"),
    ];

    // assert
    assert.deepStrictEqual(verdicts, [true, true]);
  });

  test("GV-02: a legacy sha- version of another commit, or any other version, differs", () => {
    // act
    const verdicts = [
      isSameVersion("sha-a1b2c3d4e5f6", "0123456789ab"),
      isSameVersion("sha-a1b2c3d4e5f6", "1.0.0"),
      isSameVersion("1.0.0", "a1b2c3d4e5f6"),
    ];

    // assert
    assert.deepStrictEqual(verdicts, [false, false, false]);
  });

  test("GV-01: a version with the recorded commit appended is the version it extends", () => {
    // act
    const verdicts = [
      isSameVersion("2.0.0-a1b2c3d4e5f6", "2.0.0", FULL_SHA),
      isSameVersion("2.0.0-a1b2c3d4e5f6", "2.0.0-a1b2c3d4e5f6", FULL_SHA),
    ];

    // assert
    assert.deepStrictEqual(verdicts, [true, true]);
  });

  test("GV-01: a commit suffix of another commit, another version, or no recorded commit differs", () => {
    // act
    const verdicts = [
      isSameVersion("2.0.0-a1b2c3d4e5f6", "2.0.0", PIN),
      isSameVersion("2.0.0-a1b2c3d4e5f6", "2.1.0", FULL_SHA),
      isSameVersion("2.0.0-a1b2c3d4e5f6", "2.0.0"),
      isSameVersion("2.0.0", "2.0.0-a1b2c3d4e5f6", FULL_SHA),
    ];

    // assert
    assert.deepStrictEqual(verdicts, [false, false, false, false]);
  });
});
