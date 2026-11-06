import assert from "node:assert/strict";
import { mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  createLegacyServersReader,
  recordedMcpServers,
} from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  LegacyServersReader,
  LegacyServersSource,
} from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const RESOLVED_SHA = "a".repeat(40);

/** A `pluginCloneKey` output: the clone entry of a git-source plugin. */
const CLONE_KEY = "0123456789ab-0123456789ab";

/** A `pluginMirrorKey` output: the mirror entry of a tag-pinned path-source plugin. */
const MIRROR_KEY = "0123456789ab";

const GITHUB_MARKETPLACE = { kind: "github", raw: "owner/mp" } as const;

function installRecord(resolvedSource = "/abs/plugin-root"): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: ["mcpServers"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
  };
}

function gitRecord(resolvedSource: string): PluginInstallRecord {
  return { ...installRecord(resolvedSource), resolvedSha: RESOLVED_SHA };
}

async function writeJson(filePath: string, document: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(document));
}

interface MarketplaceFixture {
  readonly root: string;
  readonly marketplaceRoot: string;
  readonly locations: ScopedLocations;
  readonly source: LegacyServersSource;
}

/** Where a cloned fixture marketplace's recorded root lies. */
type ClonedPlacement = "checkout" | "outside-checkout";

/**
 * A marketplace `mp` in a fresh hermetic environment, listing `entries`, read
 * with the user scope's locations. Each entry declares version 1.0.0, the
 * version `installRecord` names, unless it declares its own. Without
 * `entries`, no manifest file exists. A path-source marketplace lives in a
 * directory of its own. A cloned marketplace (`cloned`) records its root in
 * the scope's `sources/mp/` checkout, or outside it.
 */
async function marketplaceListing(
  t: TestContext,
  entries: readonly Record<string, unknown>[] | undefined,
  cloned?: ClonedPlacement,
): Promise<MarketplaceFixture> {
  const environment = await createHermeticEnvironment(t, "recorded-servers-");
  const locations = locationsFor("user", environment.cwd);
  const marketplaceRoot =
    cloned === "checkout"
      ? path.join(locations.sourcesDir, "mp")
      : path.join(environment.root, "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(marketplaceRoot, { recursive: true });
  if (entries !== undefined) {
    await writeJson(manifestPath, {
      name: "mp",
      plugins: entries.map((entry) => ({ version: "1.0.0", ...entry })),
    });
  }

  return {
    root: environment.root,
    marketplaceRoot,
    locations,
    source: {
      marketplaceName: "mp",
      marketplace: {
        manifestPath,
        marketplaceRoot,
        source: cloned === undefined ? { kind: "path", raw: marketplaceRoot } : GITHUB_MARKETPLACE,
      },
      pluginName: "p1",
      locations,
    },
  };
}

/** Every path under `root` with the text of each file, to prove the read wrote nothing. */
async function treeOf(root: string): Promise<Record<string, string | null>> {
  const tree: Record<string, string | null> = {};
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(entry.parentPath, entry.name);
    tree[path.relative(root, entryPath)] = entry.isFile()
      ? await readFile(entryPath, "utf8")
      : null;
  }

  return tree;
}

/** The legacy reader factory `recordedMcpServers` takes. */
type LegacyServersReaderFactory = (source: LegacyServersSource) => LegacyServersReader;

describe("recordedMcpServers", () => {
  test("MREC-01: returns the recorded servers and bundle without calling the legacy reader", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const record: PluginInstallRecord = {
      ...installRecord(path.join(marketplace.marketplaceRoot, "plugin")),
      mcpServerConfigs: [
        { name: "a", config: { command: "node", args: ["a.js"] } },
        { name: "b", config: { type: "http", url: "https://mcp.example.com" } },
      ],
      mcpBundle: true,
    };
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, () => reader);

    // assert
    assert.deepStrictEqual(recorded, {
      kind: "recorded",
      servers: [
        { name: "a", config: { command: "node", args: ["a.js"] } },
        { name: "b", config: { type: "http", url: "https://mcp.example.com" } },
      ],
      bundle: true,
    });
    verify(reader);
  });

  test("MREC-01: reads a present empty list as no servers without calling the legacy reader", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const record: PluginInstallRecord = {
      ...installRecord(path.join(marketplace.marketplaceRoot, "plugin")),
      mcpServerConfigs: [],
    };
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, () => reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "recorded", servers: [], bundle: false });
    verify(reader);
  });

  test("MREC-02: re-resolves a record that predates the field through the legacy reader", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenResolve({
      servers: [{ name: "a", config: { command: "node" } }],
      bundle: true,
    });

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, () => reader);

    // assert
    assert.deepStrictEqual(recorded, {
      kind: "re-resolved",
      servers: [{ name: "a", config: { command: "node" } }],
      bundle: true,
    });
    verify(reader);
  });

  test("MREC-02: reads a legacy reader that rejects as unreadable and logs why", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const logged = captureDebugLog(t);
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenReject(new Error("manifest gone"));

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, () => reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, ["[mcp] recorded MCP servers unreadable: manifest gone"]);
    verify(reader);
  });

  test("MREC-02: reads a legacy reader that throws as unreadable and logs why", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const logged = captureDebugLog(t);
    const record = installRecord();
    const reader: LegacyServersReader = () => {
      throw new Error("plugin root gone");
    };

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, () => reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, ["[mcp] recorded MCP servers unreadable: plugin root gone"]);
  });

  test("UF-4: logs a legacy reader failure that names an absolute path without the path", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const logged = captureDebugLog(t);
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenReject(
      new Error(
        "ENOENT: no such file or directory, open '/home/someone/.pi/agent/pi-claude-marketplace/sources/mp/.claude-plugin/marketplace.json'",
      ),
    );

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, () => reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, [
      "[mcp] recorded MCP servers unreadable: ENOENT: no such file or directory, open 'marketplace.json'",
    ]);
    verify(reader);
  });

  test("UF-1: reads a legacy record whose plugin root is outside its marketplace as unreadable", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    const outside = path.join(marketplace.root, "outside", "plugin");
    await writeJson(path.join(outside, ".mcp.json"), {
      mcpServers: { escaped: { command: "escaped" } },
    });
    const logged = captureDebugLog(t);

    // act
    const recorded = await recordedMcpServers(
      installRecord(outside),
      marketplace.source,
      createLegacyServersReader,
    );

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, [
      "[mcp] recorded MCP servers unreadable: cannot re-resolve the MCP servers of p1@mp: uncontained",
    ]);
  });

  test("UF-1 / NFR-10: reads the stored servers of a record whose plugin root is outside its marketplace as unreadable", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const logged = captureDebugLog(t);
    const record: PluginInstallRecord = {
      ...installRecord(path.join(marketplace.root, "outside", "plugin")),
      mcpServerConfigs: [{ name: "a", config: { command: "node" } }],
    };
    const readerFor = mock<LegacyServersReaderFactory>({
      exactParams: true,
      name: "legacy reader factory",
    });

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, readerFor);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, [
      "[mcp] recorded MCP servers unreadable: cannot re-resolve the MCP servers of p1@mp: uncontained",
    ]);
    verify(readerFor);
  });

  test("UF-1: reads the stored servers of a record whose plugin root runs through a symlink out of its marketplace as unreadable", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined);
    const outside = path.join(marketplace.root, "outside");
    await mkdir(path.join(outside, "plugin"), { recursive: true });
    await symlink(outside, path.join(marketplace.marketplaceRoot, "linked"));
    const record: PluginInstallRecord = {
      ...installRecord(path.join(marketplace.marketplaceRoot, "linked", "plugin")),
      mcpServerConfigs: [{ name: "a", config: { command: "node" } }],
    };
    const readerFor = mock<LegacyServersReaderFactory>({
      exactParams: true,
      name: "legacy reader factory",
    });

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, readerFor);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    verify(readerFor);
  });

  test("UF-1: returns the stored servers of a git record inside its own plugin clone", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, undefined, "checkout");
    const record: PluginInstallRecord = {
      ...gitRecord(path.join(marketplace.locations.pluginClonesDir, CLONE_KEY)),
      mcpServerConfigs: [{ name: "a", config: { command: "node" } }],
    };
    const readerFor = mock<LegacyServersReaderFactory>({
      exactParams: true,
      name: "legacy reader factory",
    });

    // act
    const recorded = await recordedMcpServers(record, marketplace.source, readerFor);

    // assert
    assert.deepStrictEqual(recorded, {
      kind: "recorded",
      servers: [{ name: "a", config: { command: "node" } }],
      bundle: false,
    });
    verify(readerFor);
  });
});

describe("createLegacyServersReader", () => {
  test("MREC-02: re-resolves a path-source plugin's .mcp.json and plugin.json servers in merge order", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    const pluginRoot = path.join(marketplace.marketplaceRoot, "plugin");
    await writeJson(path.join(pluginRoot, ".mcp.json"), {
      mcpServers: {
        alpha: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/alpha.js"] },
        beta: { type: "http", url: "https://beta.example.com/mcp" },
      },
    });
    await writeJson(path.join(pluginRoot, ".claude-plugin", "plugin.json"), {
      name: "p1",
      mcpServers: { gamma: { command: "gamma" }, alpha: { command: "python" } },
    });
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(installRecord(pluginRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [
        { name: "alpha", config: { command: "python" } },
        { name: "beta", config: { type: "http", url: "https://beta.example.com/mcp" } },
        { name: "gamma", config: { command: "gamma" } },
      ],
      bundle: false,
    });
  });

  test("MREC-02: takes the marketplace entry's servers when the plugin has no plugin.json", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [
      {
        name: "p1",
        source: "./plugin",
        mcpServers: { local: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/server.js"] } },
      },
    ]);
    const pluginRoot = path.join(marketplace.marketplaceRoot, "plugin");
    await mkdir(pluginRoot, { recursive: true });
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(installRecord(pluginRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [
        { name: "local", config: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/server.js"] } },
      ],
      bundle: false,
    });
  });

  test("MREC-01: reports a bundle when the plugin's declaration names an .mcpb file", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    const pluginRoot = path.join(marketplace.marketplaceRoot, "plugin");
    await writeJson(path.join(pluginRoot, ".claude-plugin", "plugin.json"), {
      name: "p1",
      mcpServers: ["server.mcpb", { local: { command: "node" } }],
    });
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(installRecord(pluginRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [{ name: "local", config: { command: "node" } }],
      bundle: true,
    });
  });

  test("NFR-5: re-resolves a git-source record from its plugin clone without cloning or writing", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [
      { name: "p1", source: { source: "url", url: "https://git.example.com/p1.git" } },
    ]);
    const pluginRoot = path.join(marketplace.locations.pluginClonesDir, CLONE_KEY);
    await writeJson(path.join(pluginRoot, ".mcp.json"), {
      mcpServers: { remote: { type: "http", url: "https://remote.example.com/mcp" } },
    });
    const treeBefore = await treeOf(marketplace.root);
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(gitRecord(pluginRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [
        { name: "remote", config: { type: "http", url: "https://remote.example.com/mcp" } },
      ],
      bundle: false,
    });
    assert.deepStrictEqual(await treeOf(marketplace.root), treeBefore);
  });

  test("MREC-02: re-resolves a git-source record without a recorded sha from its marketplace", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [
      { name: "p1", source: { source: "github", repo: "owner/p1" } },
    ]);
    const pluginRoot = path.join(marketplace.marketplaceRoot, "p1");
    await writeJson(path.join(pluginRoot, ".mcp.json"), {
      mcpServers: { local: { command: "node" } },
    });
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(installRecord(pluginRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [{ name: "local", config: { command: "node" } }],
      bundle: false,
    });
  });

  test("D-07-06: re-resolves a tag-pinned path-source record from its recorded copy", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    await mkdir(path.join(marketplace.marketplaceRoot, "plugin"), { recursive: true });
    const pinnedRoot = path.join(marketplace.locations.pluginClonesDir, MIRROR_KEY, "plugin");
    await writeJson(path.join(pinnedRoot, ".mcp.json"), {
      mcpServers: { pinned: { command: "pinned" } },
    });
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(gitRecord(pinnedRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [{ name: "pinned", config: { command: "pinned" } }],
      bundle: false,
    });
  });

  test("GV-01: re-resolves a record installed at a release tag at that tag's version", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    await mkdir(path.join(marketplace.marketplaceRoot, "plugin"), { recursive: true });
    const pinnedRoot = path.join(marketplace.locations.pluginClonesDir, MIRROR_KEY, "plugin");
    await writeJson(path.join(pinnedRoot, ".mcp.json"), {
      mcpServers: { pinned: { command: "pinned" } },
    });
    const record: PluginInstallRecord = {
      ...gitRecord(pinnedRoot),
      version: "1.0.0-aaaaaaaaaaaa",
      resolvedVersion: "1.0.0",
    };
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(record);

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [{ name: "pinned", config: { command: "pinned" } }],
      bundle: false,
    });
  });

  test("UF-1: re-resolves a path record of a cloned marketplace inside its checkout", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(
      t,
      [{ name: "p1", source: "./plugin" }],
      "checkout",
    );
    const pluginRoot = path.join(marketplace.marketplaceRoot, "plugin");
    await writeJson(path.join(pluginRoot, ".mcp.json"), {
      mcpServers: { cloned: { command: "cloned" } },
    });
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(installRecord(pluginRoot));

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [{ name: "cloned", config: { command: "cloned" } }],
      bundle: false,
    });
  });

  for (const { title, cloned, record } of [
    {
      title: "a git record whose plugin root runs through a symlink out of its clone",
      cloned: undefined,
      record: async ({ root, locations }: MarketplaceFixture) => {
        const clone = path.join(locations.pluginClonesDir, CLONE_KEY);
        const outside = path.join(root, "outside");
        await mkdir(clone, { recursive: true });
        await mkdir(path.join(outside, "p1"), { recursive: true });
        await symlink(outside, path.join(clone, "linked"));
        return gitRecord(path.join(clone, "linked", "p1"));
      },
    },
    {
      title: "a plugin root whose `..` segments climb out of its marketplace",
      cloned: undefined,
      record: ({ marketplaceRoot }: MarketplaceFixture) =>
        Promise.resolve(
          installRecord([marketplaceRoot, "plugin", "..", "..", "elsewhere"].join(path.sep)),
        ),
    },
    {
      title: "a git record under the plugin clones whose clone key is malformed",
      cloned: undefined,
      record: ({ locations }: MarketplaceFixture) =>
        Promise.resolve(gitRecord(path.join(locations.pluginClonesDir, "shared", "p1"))),
    },
    {
      title: "a record without a commit whose plugin root lies in the plugin clones",
      cloned: undefined,
      record: ({ locations }: MarketplaceFixture) =>
        Promise.resolve(installRecord(path.join(locations.pluginClonesDir, CLONE_KEY, "p1"))),
    },
    {
      title: "a path record whose plugin root is outside its marketplace root",
      cloned: undefined,
      record: ({ root }: MarketplaceFixture) =>
        Promise.resolve(installRecord(path.join(root, "outside", "p1"))),
    },
    {
      title: "a cloned marketplace whose recorded root is outside its checkout",
      cloned: "outside-checkout",
      record: ({ marketplaceRoot }: MarketplaceFixture) =>
        Promise.resolve(installRecord(path.join(marketplaceRoot, "plugin"))),
    },
  ] as const) {
    test(`UF-1: refuses ${title} before it reads the manifest`, async (t) => {
      // arrange -- no manifest exists, so a read before the check fails differently
      const marketplace = await marketplaceListing(t, undefined, cloned);
      const reader = createLegacyServersReader(marketplace.source);

      // act & assert
      await assert.rejects(reader(await record(marketplace)), {
        name: "LegacyServersUnreadableError",
        reason: "uncontained",
        plugin: "p1",
        marketplace: "mp",
      });
    });
  }

  test("MREC-02: refuses a re-resolution whose version is not the one the record names", async (t) => {
    // arrange -- `marketplace update` moved the live plugin directory to 1.1.0
    const marketplace = await marketplaceListing(t, [
      { name: "p1", source: "./plugin", version: "1.1.0" },
    ]);
    const pluginRoot = path.join(marketplace.marketplaceRoot, "plugin");
    await writeJson(path.join(pluginRoot, ".mcp.json"), {
      mcpServers: { added: { command: "added" } },
    });
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(reader(installRecord(pluginRoot)), {
      name: "LegacyServersUnreadableError",
      reason: "version-mismatch",
      plugin: "p1",
      marketplace: "mp",
    });
  });

  test("MREC-02: refuses a plugin the marketplace manifest no longer lists", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "other", source: "./other" }]);
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(reader(installRecord(path.join(marketplace.marketplaceRoot, "plugin"))), {
      name: "LegacyServersUnreadableError",
      reason: "not-in-manifest",
      plugin: "p1",
      marketplace: "mp",
    });
  });

  test("MREC-02: refuses a re-resolution that resolves unavailable", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(reader(installRecord(path.join(marketplace.marketplaceRoot, "plugin"))), {
      name: "LegacyServersUnreadableError",
      reason: "unavailable",
      plugin: "p1",
      marketplace: "mp",
    });
  });

  test("MREC-02: refuses a re-resolved plugin root that differs from the recorded one", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./moved" }]);
    await mkdir(path.join(marketplace.marketplaceRoot, "moved"), { recursive: true });
    await mkdir(path.join(marketplace.marketplaceRoot, "plugin"), { recursive: true });
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(reader(installRecord(path.join(marketplace.marketplaceRoot, "plugin"))), {
      name: "LegacyServersUnreadableError",
      reason: "root-mismatch",
      plugin: "p1",
      marketplace: "mp",
    });
  });
});
