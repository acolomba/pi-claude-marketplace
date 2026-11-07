import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  classifyInstalledForImplementation,
  composeInstalledListRow,
  type ComposeInstalledListRowOptions,
  type InstalledListRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { advanceWarmMirror, seedWarmMirror } from "./warm-mirror-seed.ts";

import type { ManifestPluginEntry } from "../../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type ComposeInstalledListRow = (
  options: ComposeInstalledListRowOptions,
) => Promise<InstalledListRow>;

function loadComposeInstalledListRow(): Promise<ComposeInstalledListRow> {
  return Promise.resolve(composeInstalledListRow);
}

interface PluginRecordOverrides {
  readonly compatibility?: PluginInstallRecord["compatibility"];
  readonly enabled?: boolean;
  readonly resources?: PluginInstallRecord["resources"];
  readonly resolvedSha?: string;
  readonly resolvedVersion?: string;
  readonly version?: string;
}

function pluginRecord(overrides: PluginRecordOverrides = {}): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugin",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface ManifestEntryOverrides {
  readonly binaries?: Record<string, string>;
  readonly lspServers?: ManifestPluginEntry["lspServers"];
  readonly name?: string;
  readonly version?: string;
}

function manifestEntry(overrides: ManifestEntryOverrides = {}): ManifestPluginEntry {
  return {
    name: "alpha",
    source: "./alpha",
    version: "1.0.0",
    description: "Alpha plugin.",
    ...overrides,
  };
}

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/** Which plugin a test marketplace record lists, the scope it names, and its name. */
interface MarketplaceRecordOverrides {
  readonly plugin?: string;
  readonly scope?: Scope;
  readonly name?: string;
}

interface InstalledEnvironment {
  readonly cwd: string;
  readonly marketplaceRoot: string;
  /**
   * The marketplace record `third-party` of `scope` (default `user`), which
   * lists `record` as `plugin` (default `alpha`).
   */
  readonly marketplaceFor: (
    record: PluginInstallRecord,
    overrides?: MarketplaceRecordOverrides,
  ) => MarketplaceRecord;
  readonly mcpImplementation: "adapter";
}

async function installedEnvironment(testContext: TestContext): Promise<InstalledEnvironment> {
  const environment = await createHermeticEnvironment(testContext, "list-installed-row-");
  // UF-1: the undefined `source` reads as a cloned marketplace, whose root
  // lies in the scope's checkout.
  const marketplaceRoot = path.join(
    locationsFor("user", environment.cwd).sourcesDir,
    "third-party",
  );
  await mkdir(marketplaceRoot, { recursive: true });
  return {
    cwd: environment.cwd,
    marketplaceRoot,
    marketplaceFor: (record, { plugin = "alpha", scope = "user", name = "third-party" } = {}) => ({
      name,
      scope,
      source: undefined,
      addedFromCwd: environment.cwd,
      manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
      marketplaceRoot,
      plugins: { [plugin]: record },
    }),
    mcpImplementation: "adapter",
  };
}

test("composes a same-scope installed row with exact dependencies and description", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const entry = manifestEntry();
  const record = pluginRecord({
    resources: {
      agents: ["alpha-agent"],
      hooks: [],
      mcpServers: ["alpha-server"],
      prompts: [],
      skills: [],
      workflows: ["alpha:greet"],
    },
  });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: ["agents", { kind: "mcp", runEvery: "adapter" }, "workflows"],
    version: "1.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("composes a cross-scope state-only row with the exact absence reason", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "project",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord(), { scope: "project" }),
    lookup: { kind: "absent" },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: [],
    version: "1.0.0",
    scope: "project",
    reasons: ["not in manifest"],
    severity: "info",
    needsReload: false,
  });
});

test("does not claim manifest absence when the manifest is unverified", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord()),
    lookup: { kind: "unverified" },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: [],
    version: "1.0.0",
    severity: "info",
    needsReload: false,
  });
});

test("composes a disabled row before version drift and partial state", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const entry = manifestEntry({ version: "9.0.0" });
  const record = pluginRecord({
    enabled: false,
    compatibility: {
      installable: false,
      notes: ["unsupported lspServers"],
      supported: [],
      unsupported: ["lspServers"],
    },
  });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "disabled",
    name: "alpha",
    version: "1.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("composes a manifest-absent disabled row with no suspended reasons", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record = pluginRecord({
    enabled: false,
    compatibility: {
      installable: false,
      notes: ["unsupported lspServers"],
      supported: [],
      unsupported: ["lspServers"],
    },
  });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "absent" },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "disabled",
    name: "alpha",
    version: "1.0.0",
    reasons: ["not in manifest"],
    severity: "info",
    needsReload: false,
  });
});

test("composes a degraded row with exact ordered reasons", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record = pluginRecord({
    compatibility: {
      installable: false,
      notes: ["unsupported lspServers", "unsupported hooks"],
      supported: [],
      unsupported: ["lspServers", "hooks"],
    },
  });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "absent" },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "alpha",
    reasons: ["not in manifest", "lsp", "unsupported hooks"],
    version: "1.0.0",
  });
});

test("keeps a degraded row partially installed when a newer candidate is clean", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"), { recursive: true });
  const entry = manifestEntry({ version: "2.0.0" });
  const record = pluginRecord({
    compatibility: {
      installable: false,
      notes: ["unsupported lspServers"],
      supported: [],
      unsupported: ["lspServers"],
    },
  });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "alpha",
    reasons: ["lsp"],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

test("composes a partially upgradable row from a newly degraded candidate", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"), { recursive: true });
  const entry = manifestEntry({ version: "2.0.0", lspServers: { alpha: {} } });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord()),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-upgradable",
    name: "alpha",
    reasons: ["lsp"],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

test("composes an upgradable row for a clean newer candidate", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"), { recursive: true });
  const entry = manifestEntry({ version: "2.0.0" });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord()),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "alpha",
    reasons: [],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

test("degrades a candidate probe failure to an upgradable row", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const entry = manifestEntry({ name: "bad/name", version: "2.0.0" });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "bad/name",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord(), { plugin: "bad/name" }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "bad/name",
    reasons: [],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

async function writePluginVersion(pluginRoot: string, version: string): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "alpha", version }),
  );
}

test("VER-02: a path plugin at its plugin.json version lists as installed although the entry differs", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await writePluginVersion(path.join(environment.marketplaceRoot, "alpha"), "2.0.0");
  const entry = manifestEntry({ version: "1.0.0" });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord({ version: "2.0.0" })),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("VER-02: a path plugin whose plugin.json moved past the record lists as upgradable although the entry matches", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await writePluginVersion(path.join(environment.marketplaceRoot, "alpha"), "2.1.0");
  const entry = manifestEntry({ version: "2.0.0" });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord({ version: "2.0.0" })),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "alpha",
    reasons: [],
    version: "2.0.0",
    description: "Alpha plugin.",
  });
});

test("flags binaries on an upgrade candidate of an official marketplace", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"), { recursive: true });
  const entry = manifestEntry({ version: "2.0.0", binaries: { tool: "https://example.com/tool" } });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(pluginRecord(), { name: "claude-plugins-official" }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-upgradable",
    name: "alpha",
    reasons: ["unsupported component"],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

const WARM_URL = "https://example.com/warm-plugin";

test("VER-01: a git plugin at its warm tree's plugin.json version lists as installed although the entry differs", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  await seedWarmMirror(locationsFor("project", environment.cwd), WARM_URL, {
    name: "warm-plugin",
    version: "1.0.0",
  });
  const entry: ManifestPluginEntry = { name: "warm-plugin", source: WARM_URL, version: "0.9.0" };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "warm-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(pluginRecord({ version: "1.0.0" }), {
      plugin: "warm-plugin",
      scope: "project",
    }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "warm-plugin",
    dependencies: [],
    version: "1.0.0",
    severity: "info",
    needsReload: false,
  });
});

test("VER-01: an undeclared git plugin whose warm mirror moved to a new commit lists as upgradable", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const { mirrorDirectory, head } = await seedWarmMirror(
    locationsFor("project", environment.cwd),
    WARM_URL,
    { name: "warm-plugin" },
  );
  await advanceWarmMirror(mirrorDirectory);
  const entry: ManifestPluginEntry = { name: "warm-plugin", source: WARM_URL };
  const recordedVersion = head.slice(0, 12);

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "warm-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(pluginRecord({ version: recordedVersion }), {
      plugin: "warm-plugin",
      scope: "project",
    }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "warm-plugin",
    reasons: [],
    version: recordedVersion,
  });
});

test("GV-02: an undeclared git plugin recorded as sha- at its warm mirror's commit lists as installed", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const { head } = await seedWarmMirror(locationsFor("project", environment.cwd), WARM_URL, {
    name: "warm-plugin",
  });
  const entry: ManifestPluginEntry = { name: "warm-plugin", source: WARM_URL };
  const recordedVersion = `sha-${head.slice(0, 12)}`;

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "warm-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(pluginRecord({ version: recordedVersion }), {
      plugin: "warm-plugin",
      scope: "project",
    }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "warm-plugin",
    dependencies: [],
    version: recordedVersion,
    severity: "info",
    needsReload: false,
  });
});

test("a git plugin with no mirror and no entry version lists as installed", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const entry: ManifestPluginEntry = { name: "cold-plugin", source: WARM_URL };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "cold-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(pluginRecord({ version: "0123456789ab" }), {
      plugin: "cold-plugin",
      scope: "project",
    }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "cold-plugin",
    dependencies: [],
    version: "0123456789ab",
    severity: "info",
    needsReload: false,
  });
});

test("GV-01: a pinned plugin directory entry with no mirror matches its record's pinned version", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const pin = "0123456789abcdef0123456789abcdef01234567";
  const entry: ManifestPluginEntry = {
    name: "cold-plugin",
    source: { source: "url", url: WARM_URL, sha: pin },
    version: "1.0.0",
  };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "cold-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(pluginRecord({ version: "1.0.0-0123456789ab" }), {
      plugin: "cold-plugin",
      scope: "project",
      name: "anthropic-plugin-directory",
    }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "cold-plugin",
    dependencies: [],
    version: "1.0.0-0123456789ab",
    severity: "info",
    needsReload: false,
  });
});

test("GV-01: a git plugin recorded at a release tag's commit is upgradable to its entry version without the commit", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const tagCommit = "0123456789abcdef0123456789abcdef01234567";
  const entry: ManifestPluginEntry = { name: "cold-plugin", source: WARM_URL, version: "2.0.0" };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "cold-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(
      pluginRecord({
        version: "2.0.0-0123456789ab",
        resolvedSha: tagCommit,
        resolvedVersion: "2.0.0",
      }),
      { plugin: "cold-plugin", scope: "project" },
    ),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "cold-plugin",
    reasons: [],
    version: "2.0.0-0123456789ab",
  });
});

test("a git plugin with no mirror falls back to the entry version and lists as upgradable", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const entry: ManifestPluginEntry = { name: "cold-plugin", source: WARM_URL, version: "2.0.0" };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "cold-plugin",
    pluginScope: "project",
    marketplaceScope: "project",
    marketplace: environment.marketplaceFor(pluginRecord({ version: "1.0.0" }), {
      plugin: "cold-plugin",
      scope: "project",
    }),
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "cold-plugin",
    reasons: [],
    version: "1.0.0",
  });
});

const EVENTS = { type: "sse", url: "https://mcp.example.com/sse" };

/** D-P3-02: a record an install stored with the neutral verdict and its one sse server. */
function neutralSseRecord(overrides: PluginRecordOverrides = {}): PluginInstallRecord {
  return {
    ...pluginRecord({
      resources: {
        agents: [],
        hooks: [],
        mcpServers: ["events"],
        prompts: [],
        skills: [],
        workflows: [],
      },
      ...overrides,
    }),
    compatibilityBasis: "neutral",
    mcpServerConfigs: [{ name: "events", config: EVENTS }],
  };
}

test("MREC-03: lists a neutral sse record as installed under pi-mcp-adapter", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor({
      ...neutralSseRecord(),
      resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    }),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: [{ kind: "mcp", runEvery: "adapter" }],
    version: "1.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("MREC-03 / D-P3-05: lists the same record as partially installed under Pi's built-in MCP", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);

  // act
  const row = await composeInstalledListRow({
    ...environment,
    mcpImplementation: "builtin",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor({
      ...neutralSseRecord(),
      resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    }),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "alpha",
    reasons: ["unsupported mcp"],
    dependencies: [{ kind: "mcp", runEvery: "adapter" }],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

test("MREC-03: lists a disabled sse record as disabled under Pi's built-in MCP", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);

  // act
  const row = await composeInstalledListRow({
    ...environment,
    mcpImplementation: "builtin",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(neutralSseRecord({ enabled: false })),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "disabled",
    name: "alpha",
    version: "1.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("D-P6-22 / ENBL-04: classifies a disabled record without reading its MCP verdict", async (testContext) => {
  // arrange
  const environment = await installedEnvironment(testContext);
  const debugLines = captureDebugLog(testContext);

  // act
  const view = await classifyInstalledForImplementation({
    ...environment,
    mcpImplementation: "builtin",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(
      pluginRecord({
        enabled: false,
        resources: {
          agents: [],
          hooks: [],
          mcpServers: ["events"],
          prompts: [],
          skills: [],
          workflows: [],
        },
      }),
    ),
    lookup: { kind: "absent" },
  });

  // assert
  assert.deepStrictEqual(view, { kind: "disabled" });
  assert.deepStrictEqual(debugLines, []);
});

test("D-P6-22: classifies an enabled record with the MCP verdict and candidate it read", async (testContext) => {
  // arrange
  const environment = await installedEnvironment(testContext);

  // act
  const view = await classifyInstalledForImplementation({
    ...environment,
    mcpImplementation: "builtin",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor({
      ...neutralSseRecord(),
      resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    }),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(view, {
    kind: "enabled",
    status: "partially-installed",
    effective: {
      installable: false,
      unsupported: ["mcpServers"],
      blocked: [{ server: "events", feature: "sse" }],
    },
    recorded: { kind: "recorded", servers: [{ name: "events", config: EVENTS }], bundle: false },
    candidate: { upgradable: false },
  });
});

for (const { mcpImplementation, expectedRow } of [
  {
    mcpImplementation: "adapter",
    expectedRow: {
      status: "upgradable",
      name: "alpha",
      reasons: [],
      version: "1.0.0",
      description: "Alpha plugin.",
    },
  },
  {
    mcpImplementation: "builtin",
    expectedRow: {
      status: "partially-upgradable",
      name: "alpha",
      reasons: ["unsupported mcp"],
      version: "1.0.0",
      description: "Alpha plugin.",
    },
  },
] as const) {
  test(`D-P3-03: a newer candidate with an sse server lists as ${expectedRow.status} under ${mcpImplementation}`, async (testContext) => {
    // arrange
    const composeInstalledListRow = await loadComposeInstalledListRow();
    const environment = await installedEnvironment(testContext);
    const pluginRoot = path.join(environment.marketplaceRoot, "alpha");
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { events: EVENTS } }),
    );

    // act
    const row = await composeInstalledListRow({
      ...environment,
      mcpImplementation,
      pluginName: "alpha",
      pluginScope: "user",
      marketplaceScope: "user",
      marketplace: environment.marketplaceFor(pluginRecord()),
      lookup: { kind: "declared", entry: manifestEntry({ version: "2.0.0" }) },
    });

    // assert
    assert.deepStrictEqual(row, expectedRow);
  });
}

test("D-P3-10: an installed row over a record whose staged server is a ws server carries no MCP dependency", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record: PluginInstallRecord = {
    ...pluginRecord({
      resources: {
        agents: [],
        hooks: [],
        mcpServers: ["live"],
        prompts: [],
        skills: [],
        workflows: [],
      },
    }),
    resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    mcpServerConfigs: [{ name: "live", config: { type: "ws", url: "wss://mcp.example.com/ws" } }],
  };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: [],
    version: "1.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("D-P3-10 / D-MB-07: an installed row under Pi's built-in MCP carries the server the adapter did not stage", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record: PluginInstallRecord = {
    ...pluginRecord(),
    resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    compatibilityBasis: "neutral",
    mcpServerConfigs: [
      { name: "asker", config: { command: "node", bareElicitationCapability: true } },
    ],
  };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    mcpImplementation: "builtin",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: [{ kind: "mcp", runEvery: "builtin" }],
    version: "1.0.0",
    description: "Alpha plugin.",
    severity: "info",
    needsReload: false,
  });
});

test("D-P3-07 / D-MB-07: a partially-installed row under pi-mcp-adapter carries the server only Pi's built-in MCP runs", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record: PluginInstallRecord = {
    ...pluginRecord(),
    resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    compatibilityBasis: "neutral",
    mcpServerConfigs: [
      { name: "asker", config: { command: "node", bareElicitationCapability: true } },
    ],
  };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "alpha",
    reasons: ["unsupported mcp"],
    dependencies: [{ kind: "mcp", runEvery: "builtin" }],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

test("MREC-07: a partially-installed row over a ws server neither implementation runs carries no dependency", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record: PluginInstallRecord = {
    ...pluginRecord({
      compatibility: {
        installable: false,
        notes: ["unsupported mcpServers"],
        supported: [],
        unsupported: ["mcpServers"],
      },
    }),
    resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    compatibilityBasis: "neutral",
    mcpServerConfigs: [{ name: "live", config: { type: "ws", url: "ws://127.0.0.1:9/" } }],
  };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    mcpImplementation: "builtin",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "alpha",
    reasons: ["unsupported mcp"],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});

test("D-P3-07: a partially-installed row carries only its MCP dependency, never agents or workflows", async (testContext) => {
  // arrange
  const composeInstalledListRow = await loadComposeInstalledListRow();
  const environment = await installedEnvironment(testContext);
  const record: PluginInstallRecord = {
    ...pluginRecord({
      compatibility: {
        installable: false,
        notes: ["unsupported lspServers"],
        supported: [],
        unsupported: ["lspServers"],
      },
      resources: {
        agents: ["bot"],
        hooks: [],
        mcpServers: ["tools"],
        prompts: [],
        skills: [],
        workflows: ["flow"],
      },
    }),
    resolvedSource: path.join(environment.marketplaceRoot, "alpha"),
    compatibilityBasis: "neutral",
    mcpServerConfigs: [{ name: "tools", config: { command: "node" } }],
  };

  // act
  const row = await composeInstalledListRow({
    ...environment,
    mcpImplementation: "none",
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    marketplace: environment.marketplaceFor(record),
    lookup: { kind: "declared", entry: manifestEntry() },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "alpha",
    reasons: ["lsp"],
    dependencies: [{ kind: "mcp", runEvery: "both" }],
    version: "1.0.0",
    description: "Alpha plugin.",
  });
});
