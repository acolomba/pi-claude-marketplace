import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { readRecordMcpVerdict } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts";

import type { LegacyServersSource } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const EVENTS = { type: "sse", url: "https://mcp.example.com/sse" };
const LIVE = { type: "ws", url: "wss://mcp.example.com/ws" };

function legacyRecord(
  resolvedSource: string,
  overrides: Partial<PluginInstallRecord> = {},
): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    ...overrides,
  };
}

async function writeJson(filePath: string, document: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(document));
}

interface MarketplaceFixture {
  readonly pluginRoot: string;
  readonly source: LegacyServersSource;
}

/**
 * A path-source marketplace `mp` in a fresh directory. With `listed`, its
 * manifest lists plugin `p1` at version 1.0.0 with one sse server in
 * `.mcp.json`; without it, no manifest file exists.
 */
async function marketplaceFixture(t: TestContext, listed: boolean): Promise<MarketplaceFixture> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-verdict-read-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marketplaceRoot = path.join(root, "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const pluginRoot = path.join(marketplaceRoot, "plugin");
  if (listed) {
    await writeJson(manifestPath, {
      name: "mp",
      plugins: [{ name: "p1", source: "./plugin", version: "1.0.0" }],
    });
    await writeJson(path.join(pluginRoot, ".mcp.json"), { mcpServers: { events: EVENTS } });
  }

  return {
    pluginRoot,
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

test("MREC-03: reads a record's own server configs without the manifest", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, false);
  const record = legacyRecord(marketplace.pluginRoot, {
    compatibilityBasis: "neutral",
    mcpServerConfigs: [{ name: "events", config: EVENTS }],
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: ["events"],
      hooks: [],
      workflows: [],
    },
  });

  // act
  const verdict = await readRecordMcpVerdict(record, marketplace.source, "builtin");

  // assert
  assert.deepStrictEqual(verdict, {
    effective: {
      installable: false,
      unsupported: ["mcpServers"],
      blocked: [{ server: "events", feature: "sse" }],
    },
    recorded: { kind: "recorded", servers: [{ name: "events", config: EVENTS }], bundle: false },
  });
});

test("MREC-03: reads a legacy record with no MCP trace as no servers without the manifest", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, false);

  // act
  const verdict = await readRecordMcpVerdict(
    legacyRecord(marketplace.pluginRoot),
    marketplace.source,
    "builtin",
  );

  // assert
  assert.deepStrictEqual(verdict, {
    effective: { installable: true, unsupported: [], blocked: [] },
    recorded: { kind: "re-resolved", servers: [], bundle: false },
  });
});

test("MREC-02: re-resolves a legacy record with a staged server from the cached manifest", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, true);
  const record = legacyRecord(marketplace.pluginRoot, {
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: ["events"],
      hooks: [],
      workflows: [],
    },
  });

  // act
  const verdict = await readRecordMcpVerdict(record, marketplace.source, "builtin");

  // assert
  assert.deepStrictEqual(verdict, {
    effective: {
      installable: false,
      unsupported: ["mcpServers"],
      blocked: [{ server: "events", feature: "sse" }],
    },
    recorded: { kind: "re-resolved", servers: [{ name: "events", config: EVENTS }], bundle: false },
  });
});

test("MREC-02: re-resolves a legacy record that stored the mcpServers kind", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, true);
  const record = legacyRecord(marketplace.pluginRoot, {
    compatibility: {
      installable: false,
      notes: [],
      supported: [],
      unsupported: ["mcpServers"],
    },
  });

  // act
  const verdict = await readRecordMcpVerdict(record, marketplace.source, "adapter");

  // assert
  assert.deepStrictEqual(verdict, {
    effective: { installable: false, unsupported: ["mcpServers"], blocked: [] },
    recorded: { kind: "re-resolved", servers: [{ name: "events", config: EVENTS }], bundle: false },
  });
});

test("MREC-02: keeps the stored verdict when the legacy reader cannot read the manifest", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, false);
  const record = legacyRecord(marketplace.pluginRoot, {
    compatibility: {
      installable: false,
      notes: [],
      supported: [],
      unsupported: ["hooks"],
    },
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: ["events"],
      hooks: [],
      workflows: [],
    },
  });

  // act
  const verdict = await readRecordMcpVerdict(record, marketplace.source, "builtin");

  // assert
  assert.deepStrictEqual(verdict, {
    effective: { installable: false, unsupported: ["hooks"], blocked: [] },
    recorded: { kind: "unreadable" },
  });
});

for (const { active, unsupported, blocked } of [
  {
    active: "adapter",
    unsupported: ["mcpServers"],
    blocked: [{ server: "live", feature: "ws" }],
  },
  {
    active: "builtin",
    unsupported: ["mcpServers"],
    blocked: [
      { server: "events", feature: "sse" },
      { server: "live", feature: "ws" },
    ],
  },
  {
    active: "none",
    unsupported: ["mcpServers"],
    blocked: [{ server: "live", feature: "ws" }],
  },
] as const) {
  test(`D-P3-04: reads a neutral record's verdict for the ${active} implementation`, async (t) => {
    // arrange
    const marketplace = await marketplaceFixture(t, false);
    const record = legacyRecord(marketplace.pluginRoot, {
      compatibility: { installable: false, notes: [], supported: [], unsupported: ["mcpServers"] },
      compatibilityBasis: "neutral",
      mcpServerConfigs: [
        { name: "events", config: EVENTS },
        { name: "live", config: LIVE },
      ],
    });

    // act
    const verdict = await readRecordMcpVerdict(record, marketplace.source, active);

    // assert
    assert.deepStrictEqual(verdict.effective, { installable: false, unsupported, blocked });
  });
}
