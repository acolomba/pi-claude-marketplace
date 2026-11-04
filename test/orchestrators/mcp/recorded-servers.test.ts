import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  createLegacyServersReader,
  LegacyServersUnreadableError,
  recordedMcpServers,
} from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";

import type {
  LegacyServersReader,
  LegacyServersSource,
} from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const RESOLVED_SHA = "a".repeat(40);

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

async function writeJson(filePath: string, document: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(document));
}

interface MarketplaceFixture {
  readonly root: string;
  readonly marketplaceRoot: string;
  readonly source: LegacyServersSource;
}

/**
 * A path-source marketplace `mp` in a fresh directory, listing `entries`. Each
 * entry declares version 1.0.0, the version `installRecord` names, unless it
 * declares its own.
 */
async function marketplaceListing(
  t: TestContext,
  entries: readonly Record<string, unknown>[],
): Promise<MarketplaceFixture> {
  const root = await mkdtemp(path.join(tmpdir(), "recorded-servers-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marketplaceRoot = path.join(root, "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeJson(manifestPath, {
    name: "mp",
    plugins: entries.map((entry) => ({ version: "1.0.0", ...entry })),
  });
  return {
    root,
    marketplaceRoot,
    source: {
      marketplaceName: "mp",
      marketplace: {
        manifestPath,
        marketplaceRoot,
        source: { kind: "path", raw: marketplaceRoot },
      },
      pluginName: "p1",
    },
  };
}

/** Matches the reader's refusal of plugin `p1` of marketplace `mp` for `reason`. */
function unreadableAs(reason: LegacyServersUnreadableError["reason"]): (error: unknown) => boolean {
  return (error: unknown) => {
    assert.ok(error instanceof LegacyServersUnreadableError);
    assert.deepStrictEqual(
      { reason: error.reason, plugin: error.plugin, marketplace: error.marketplace },
      { reason, plugin: "p1", marketplace: "mp" },
    );
    return true;
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

describe("recordedMcpServers", () => {
  test("MREC-01: returns the recorded servers and bundle without calling the legacy reader", async () => {
    // arrange
    const record: PluginInstallRecord = {
      ...installRecord(),
      mcpServerConfigs: [
        { name: "a", config: { command: "node", args: ["a.js"] } },
        { name: "b", config: { type: "http", url: "https://mcp.example.com" } },
      ],
      mcpBundle: true,
    };
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });

    // act
    const recorded = await recordedMcpServers(record, reader);

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

  test("MREC-01: reads a present empty list as no servers without calling the legacy reader", async () => {
    // arrange
    const record: PluginInstallRecord = { ...installRecord(), mcpServerConfigs: [] };
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "recorded", servers: [], bundle: false });
    verify(reader);
  });

  test("MREC-02: re-resolves a record that predates the field through the legacy reader", async () => {
    // arrange
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenResolve({
      servers: [{ name: "a", config: { command: "node" } }],
      bundle: true,
    });

    // act
    const recorded = await recordedMcpServers(record, reader);

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
    const logged = captureDebugLog(t);
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenReject(new Error("manifest gone"));

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, ["[mcp] recorded MCP servers unreadable: manifest gone"]);
    verify(reader);
  });

  test("MREC-02: reads a legacy reader that throws as unreadable and logs why", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const record = installRecord();
    const reader: LegacyServersReader = () => {
      throw new Error("plugin root gone");
    };

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, ["[mcp] recorded MCP servers unreadable: plugin root gone"]);
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

  test("NFR-5: re-resolves a git-source record from its recorded root without cloning or writing", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [
      { name: "p1", source: { source: "url", url: "https://git.example.com/p1.git" } },
    ]);
    const pluginRoot = path.join(marketplace.root, "plugin-clones", "p1");
    await writeJson(path.join(pluginRoot, ".mcp.json"), {
      mcpServers: { remote: { type: "http", url: "https://remote.example.com/mcp" } },
    });
    const record: PluginInstallRecord = {
      ...installRecord(pluginRoot),
      resolvedSha: RESOLVED_SHA,
    };
    const treeBefore = await treeOf(marketplace.root);
    const reader = createLegacyServersReader(marketplace.source);

    // act
    const legacy = await reader(record);

    // assert
    assert.deepStrictEqual(legacy, {
      servers: [
        { name: "remote", config: { type: "http", url: "https://remote.example.com/mcp" } },
      ],
      bundle: false,
    });
    assert.deepStrictEqual(await treeOf(marketplace.root), treeBefore);
  });

  test("MREC-02: re-resolves a git-source record without a recorded sha from its recorded root", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [
      { name: "p1", source: { source: "github", repo: "owner/p1" } },
    ]);
    const pluginRoot = path.join(marketplace.root, "plugin-clones", "p1");
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
    const pinnedRoot = path.join(marketplace.root, "plugin-clones", "mp-tag", "plugin");
    await writeJson(path.join(pinnedRoot, ".mcp.json"), {
      mcpServers: { pinned: { command: "pinned" } },
    });
    const record: PluginInstallRecord = {
      ...installRecord(pinnedRoot),
      resolvedSha: RESOLVED_SHA,
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

  test("GV-01: re-resolves a record installed at a release tag at that tag's version", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    await mkdir(path.join(marketplace.marketplaceRoot, "plugin"), { recursive: true });
    const pinnedRoot = path.join(marketplace.root, "plugin-clones", "mp-tag", "plugin");
    await writeJson(path.join(pinnedRoot, ".mcp.json"), {
      mcpServers: { pinned: { command: "pinned" } },
    });
    const record: PluginInstallRecord = {
      ...installRecord(pinnedRoot),
      version: "1.0.0-aaaaaaaaaaaa",
      resolvedSha: RESOLVED_SHA,
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
    await assert.rejects(reader(installRecord(pluginRoot)), unreadableAs("version-mismatch"));
  });

  test("MREC-02: refuses a plugin the marketplace manifest no longer lists", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "other", source: "./other" }]);
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(
      reader(installRecord(path.join(marketplace.marketplaceRoot, "plugin"))),
      unreadableAs("not-in-manifest"),
    );
  });

  test("MREC-02: refuses a re-resolution that resolves unavailable", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./plugin" }]);
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(
      reader(installRecord(path.join(marketplace.marketplaceRoot, "plugin"))),
      unreadableAs("unavailable"),
    );
  });

  test("MREC-02: refuses a re-resolved plugin root that differs from the recorded one", async (t) => {
    // arrange
    const marketplace = await marketplaceListing(t, [{ name: "p1", source: "./moved" }]);
    await mkdir(path.join(marketplace.marketplaceRoot, "moved"), { recursive: true });
    await mkdir(path.join(marketplace.marketplaceRoot, "plugin"), { recursive: true });
    const reader = createLegacyServersReader(marketplace.source);

    // act & assert
    await assert.rejects(
      reader(installRecord(path.join(marketplace.marketplaceRoot, "plugin"))),
      unreadableAs("root-mismatch"),
    );
  });
});
