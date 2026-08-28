import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  computeHashVersion,
  shaVersion,
} from "../../extensions/pi-claude-marketplace/domain/version.ts";

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

  test("ignores Git, dependency, and Finder entries", async (t) => {
    // arrange
    const pluginRoot = await createVersionSandbox(t);
    await writeFile(path.join(pluginRoot, "main.txt"), "main\n");
    await mkdir(path.join(pluginRoot, ".git"));
    await writeFile(path.join(pluginRoot, ".git", "HEAD"), "ignored\n");
    await mkdir(path.join(pluginRoot, "node_modules", "package"), {
      recursive: true,
    });
    await writeFile(path.join(pluginRoot, "node_modules", "package", "index.js"), "ignored\n");
    await writeFile(path.join(pluginRoot, ".DS_Store"), "ignored\n");

    // act
    const version = await computeHashVersion(pluginRoot);

    // assert
    assert.strictEqual(version, "hash-c5994021316d");
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

describe("shaVersion", () => {
  test("uses the first 12 characters of the resolved commit SHA", () => {
    // arrange
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const version = shaVersion(fullSha);

    // assert
    assert.strictEqual(version, "sha-a1b2c3d4e5f6");
  });
});
