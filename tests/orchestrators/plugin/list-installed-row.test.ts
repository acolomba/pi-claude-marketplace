import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  ManifestLookup,
  ManifestPluginEntry,
} from "../../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  PluginDisabledMessage,
  PluginInstalledMessage,
  PluginPartiallyInstalledMessage,
  PluginPartiallyUpgradableMessage,
  PluginUpgradableMessage,
} from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type InstalledListRow =
  | PluginDisabledMessage
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage
  | PluginUpgradableMessage;

interface ComposeInstalledListRowOptions {
  readonly pluginName: string;
  readonly pluginScope: Scope;
  readonly marketplaceScope: Scope;
  readonly marketplaceRoot: string;
  readonly record: PluginInstallRecord;
  readonly lookup: ManifestLookup;
  readonly cwd: string;
}

type ComposeInstalledListRow = (
  options: ComposeInstalledListRowOptions,
) => Promise<InstalledListRow>;

async function loadComposeInstalledListRow(): Promise<ComposeInstalledListRow> {
  let composeInstalledListRow: ComposeInstalledListRow | undefined;
  await assert.doesNotReject(async () => {
    const owner =
      await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts");
    composeInstalledListRow = owner.composeInstalledListRow;
  }, "list-installed-row.ts must own installed inventory row composition");
  assert.ok(composeInstalledListRow !== undefined);
  return composeInstalledListRow;
}

function pluginRecord(overrides: Partial<PluginInstallRecord> = {}): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugin",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function manifestEntry(overrides: Partial<ManifestPluginEntry> = {}): ManifestPluginEntry {
  return {
    name: "alpha",
    source: "./alpha",
    version: "1.0.0",
    description: "Alpha plugin.",
    ...overrides,
  };
}

async function installedEnvironment(testContext: TestContext): Promise<{
  readonly cwd: string;
  readonly marketplaceRoot: string;
}> {
  const environment = await createHermeticEnvironment(testContext, "list-installed-row-");
  const marketplaceRoot = path.join(environment.cwd, "marketplace");
  await mkdir(marketplaceRoot, { recursive: true });
  return { cwd: environment.cwd, marketplaceRoot };
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
    },
  });

  // act
  const row = await composeInstalledListRow({
    ...environment,
    pluginName: "alpha",
    pluginScope: "user",
    marketplaceScope: "user",
    record,
    lookup: { kind: "declared", entry },
  });

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "alpha",
    dependencies: ["agents", "mcp"],
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
    record: pluginRecord(),
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
    record: pluginRecord(),
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
    record,
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
    record,
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
    record,
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
    record,
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
    record: pluginRecord(),
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
    record: pluginRecord(),
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
    record: pluginRecord(),
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
