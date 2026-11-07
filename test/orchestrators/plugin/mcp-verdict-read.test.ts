import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { legacyServersSourceFor } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import {
  readRecordMcpDependency,
  readRecordMcpVerdict,
  recordDegradeBaselineReader,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { LegacyServersSource } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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

type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface MarketplaceFixture {
  readonly root: string;
  readonly pluginRoot: string;
  readonly manifestPath: string;
  readonly locations: ScopedLocations;
  /** The user scope's marketplace record `mp`, which lists `record` as `p1`. */
  readonly marketplaceFor: (record: PluginInstallRecord) => MarketplaceRecord;
  /** The servers source of `record`, which the marketplace record `mp` lists as `p1`. */
  readonly sourceFor: (record: PluginInstallRecord) => LegacyServersSource;
}

/**
 * A path-source marketplace `mp` in a fresh hermetic environment, read with
 * the user scope's locations, the scope its marketplace record names. With
 * `listed`, its manifest lists plugin `p1` at version 1.0.0 with one sse
 * server in `.mcp.json`; without it, no manifest file exists.
 */
async function marketplaceFixture(t: TestContext, listed: boolean): Promise<MarketplaceFixture> {
  const environment = await createHermeticEnvironment(t, "mcp-verdict-read-");
  const root = environment.root;
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

  const locations = locationsFor("user", environment.cwd);
  const marketplaceFor = (record: PluginInstallRecord): MarketplaceRecord => ({
    name: "mp",
    scope: "user",
    source: { kind: "path", raw: marketplaceRoot },
    addedFromCwd: environment.cwd,
    manifestPath,
    marketplaceRoot,
    plugins: { p1: record },
  });
  return {
    root,
    pluginRoot,
    manifestPath,
    locations,
    marketplaceFor,
    sourceFor: (record) => legacyServersSourceFor(locations, marketplaceFor(record), "p1"),
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
  const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), "builtin");

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
    marketplace.sourceFor(legacyRecord(marketplace.pluginRoot)),
    "builtin",
  );

  // assert
  assert.deepStrictEqual(verdict, {
    effective: { installable: true, unsupported: [], blocked: [] },
    recorded: { kind: "re-resolved", servers: [], bundle: false },
  });
});

test("MREC-02: re-resolves a neutral record without server configs that staged no server", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, true);
  const record = legacyRecord(marketplace.pluginRoot, { compatibilityBasis: "neutral" });

  // act
  const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), "builtin");

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
  const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), "builtin");

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
  const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), "adapter");

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
  const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), "builtin");

  // assert
  assert.deepStrictEqual(verdict, {
    effective: { installable: false, unsupported: ["hooks"], blocked: [] },
    recorded: { kind: "unreadable", reason: "read-failed" },
  });
});

test("UF-1: keeps the stored verdict of a git record whose plugin root is outside its clones", async (t) => {
  // arrange -- the git root callback answers the recorded root, so only containment refuses it
  const marketplace = await marketplaceFixture(t, false);
  await writeJson(marketplace.manifestPath, {
    name: "mp",
    plugins: [
      {
        name: "p1",
        source: { source: "url", url: "https://git.example.com/p1.git" },
        version: "1.0.0",
      },
    ],
  });
  const outside = path.join(marketplace.root, "outside");
  await writeJson(path.join(outside, ".mcp.json"), { mcpServers: { events: EVENTS } });
  const record = legacyRecord(outside, {
    resolvedSha: "a".repeat(40),
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
  const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), "builtin");

  // assert
  assert.deepStrictEqual(verdict, {
    effective: { installable: false, unsupported: ["hooks"], blocked: [] },
    recorded: { kind: "unreadable", reason: "uncontained" },
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
    const verdict = await readRecordMcpVerdict(marketplace.sourceFor(record), active);

    // assert
    assert.deepStrictEqual(verdict.effective, { installable: false, unsupported, blocked });
  });
}

test("P3-DC-24: reads an unreadable legacy record that staged a server as the adapter's dependency", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, false);
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
  const dependency = await readRecordMcpDependency(marketplace.sourceFor(record));

  // assert
  assert.deepStrictEqual(dependency, { kind: "mcp", runEvery: "adapter" });
});

test("D-P3-10: reads a neutral record's dependency from its recorded servers", async (t) => {
  // arrange
  const marketplace = await marketplaceFixture(t, false);
  const record = legacyRecord(marketplace.pluginRoot, {
    compatibilityBasis: "neutral",
    mcpServerConfigs: [
      { name: "events", config: EVENTS },
      { name: "live", config: LIVE },
    ],
  });

  // act
  const dependency = await readRecordMcpDependency(marketplace.sourceFor(record));

  // assert
  assert.deepStrictEqual(dependency, { kind: "mcp", runEvery: "adapter" });
});

for (const { title, marketplaceListed, active, baseline } of [
  {
    title: "a neutral record's sse drop under Pi's built-in MCP as readable",
    marketplaceListed: true,
    active: "builtin",
    baseline: { unsupported: ["mcpServers"], readable: true },
  },
  {
    title: "an unreadable legacy record's stored verdict as unreadable",
    marketplaceListed: false,
    active: "builtin",
    baseline: { unsupported: [], readable: false },
  },
] as const) {
  test(`D-P3-13: the degrade baseline reader gives ${title}`, async (t) => {
    // arrange
    const marketplace = await marketplaceFixture(t, marketplaceListed);
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
    const readBaseline = recordDegradeBaselineReader(active, marketplace.locations);

    // act
    const degradeBaseline = await readBaseline(record, marketplace.marketplaceFor(record), "p1");

    // assert
    assert.deepStrictEqual(degradeBaseline, baseline);
  });
}

test("UF-1: the degrade baseline reader reads a git record from the clone its locations name", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "mcp-verdict-read-");
  const locations = locationsFor("project", environment.cwd);
  const marketplaceRoot = path.join(environment.root, "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeJson(manifestPath, {
    name: "mp",
    plugins: [
      {
        name: "p1",
        source: { source: "url", url: "https://git.example.com/p1.git" },
        version: "1.0.0",
      },
    ],
  });
  const pluginRoot = path.join(locations.pluginClonesDir, "0123456789ab-0123456789ab");
  await writeJson(path.join(pluginRoot, ".mcp.json"), { mcpServers: { events: EVENTS } });
  const record = legacyRecord(pluginRoot, {
    resolvedSha: "a".repeat(40),
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: ["events"],
      hooks: [],
      workflows: [],
    },
  });
  const readBaseline = recordDegradeBaselineReader("builtin", locations);

  // act
  const degradeBaseline = await readBaseline(
    record,
    {
      name: "mp",
      scope: "project",
      source: { kind: "path", raw: marketplaceRoot },
      addedFromCwd: environment.cwd,
      manifestPath,
      marketplaceRoot,
      plugins: { p1: record },
    },
    "p1",
  );

  // assert
  assert.deepStrictEqual(degradeBaseline, { unsupported: ["mcpServers"], readable: true });
});
