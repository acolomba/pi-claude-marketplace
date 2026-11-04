import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  readBuiltinServerDescription,
  type BuiltinDescriptionSource,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/builtin-description.ts";

const WRAPPED = path.join(".claude-plugin", "plugin.json");
const BARE = "plugin.json";

interface PluginTree {
  readonly root: string;
  readonly pluginRoot: string;
  readonly source: BuiltinDescriptionSource;
}

/**
 * A local marketplace `mp` whose manifest lists `entries`, with the plugin
 * `demo` at `plugins/demo`, in a fresh directory.
 */
async function pluginTree(
  t: TestContext,
  entries: readonly Readonly<Record<string, unknown>>[] = [
    { name: "demo", source: "./plugins/demo", description: "Entry text" },
  ],
): Promise<PluginTree> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "builtin-description-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marketplaceRoot = path.join(root, "mp");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "demo");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(pluginRoot, { recursive: true });
  await writeText(manifestPath, JSON.stringify({ name: "mp", plugins: entries }));
  return {
    root,
    pluginRoot,
    source: { manifestPath, marketplaceRoot, pluginName: "demo", pluginRoot, pin: undefined },
  };
}

async function writeText(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text);
}

async function writeManifestAt(tree: PluginTree, candidate: string, text: string): Promise<void> {
  await writeText(path.join(tree.pluginRoot, candidate), text);
}

test("ANAME-06: the wrapped plugin.json description wins over the entry's", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await writeManifestAt(tree, WRAPPED, JSON.stringify({ name: "demo", description: "Wrapped" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Wrapped");
});

test("ANAME-06: a bare plugin.json describes the plugin when no wrapped one is there", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await writeManifestAt(tree, BARE, JSON.stringify({ name: "demo", description: "Bare" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Bare");
});

test("D-01-07: a wrapped plugin.json without a description falls to the entry, not the bare file", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await writeManifestAt(tree, WRAPPED, JSON.stringify({ name: "demo" }));
  await writeManifestAt(tree, BARE, JSON.stringify({ name: "demo", description: "Bare" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Entry text");
});

for (const { title, text } of [
  { title: "an empty description", text: JSON.stringify({ description: "" }) },
  { title: "a description that is not a string", text: JSON.stringify({ description: 5 }) },
  { title: "text that does not parse", text: "{" },
  { title: "a JSON string", text: JSON.stringify("Wrapped") },
  { title: "JSON null", text: "null" },
]) {
  test(`ANAME-06: a plugin.json holding ${title} falls to the entry's description`, async (t) => {
    // arrange
    const tree = await pluginTree(t);
    await writeManifestAt(tree, WRAPPED, text);

    // act
    const description = await readBuiltinServerDescription(tree.source);

    // assert
    assert.strictEqual(description, "Entry text");
  });
}

test("ANAME-06: with no plugin.json the entry's description answers", async (t) => {
  // arrange
  const tree = await pluginTree(t);

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Entry text");
});

test("ANAME-06: an empty entry description and no plugin.json give no description", async (t) => {
  // arrange
  const tree = await pluginTree(t, [{ name: "demo", source: "./plugins/demo", description: "" }]);

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, undefined);
});

test("D-PL2-24: a plugin.json link that leaves the boundary is not read and ends the walk", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  const outside = path.join(tree.root, "outside.json");
  await writeText(outside, JSON.stringify({ description: "Outside" }));
  await mkdir(path.join(tree.pluginRoot, ".claude-plugin"), { recursive: true });
  await symlink(outside, path.join(tree.pluginRoot, WRAPPED));
  await writeManifestAt(tree, BARE, JSON.stringify({ description: "Bare" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Entry text");
});

test("D-01-06: a dangling plugin.json link is no manifest, so the next candidate answers", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await mkdir(path.join(tree.pluginRoot, ".claude-plugin"), { recursive: true });
  await symlink(path.join(tree.pluginRoot, "gone.json"), path.join(tree.pluginRoot, WRAPPED));
  await writeManifestAt(tree, BARE, JSON.stringify({ description: "Bare" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Bare");
});

test("D-01-06: a directory spelled as the wrapped plugin.json is no manifest", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await mkdir(path.join(tree.pluginRoot, WRAPPED), { recursive: true });
  await writeManifestAt(tree, BARE, JSON.stringify({ description: "Bare" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Bare");
});

test("D-01-07: a plugin.json that cannot be read ends the walk and the entry answers", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await writeManifestAt(tree, WRAPPED, JSON.stringify({ description: "Wrapped" }));
  await chmod(path.join(tree.pluginRoot, WRAPPED), 0o000);
  await writeManifestAt(tree, BARE, JSON.stringify({ description: "Bare" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Entry text");
});

test("ANAME-06: an unreadable marketplace manifest still lets plugin.json answer", async (t) => {
  // arrange
  const tree = await pluginTree(t);
  await writeText(tree.source.manifestPath, "{");
  await writeManifestAt(tree, WRAPPED, JSON.stringify({ description: "Wrapped" }));

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, "Wrapped");
});

test("ANAME-06: a plugin the manifest no longer lists has no entry description", async (t) => {
  // arrange
  const tree = await pluginTree(t, [{ name: "other", source: "./plugins/other" }]);

  // act
  const description = await readBuiltinServerDescription(tree.source);

  // assert
  assert.strictEqual(description, undefined);
});
