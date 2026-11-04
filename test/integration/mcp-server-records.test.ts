// MREC-01 / D-MB-04: the install record keeps every declared, non-malformed
// MCP server in its Claude form, in D-CF6-01 merge order, before
// plugin-variable substitution, the servers pi-mcp-adapter blocks included.
// Each case drives the real operation in a hermetic home and reads the saved
// state.json, so a path that bypasses the record producer fails here.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { importClaudeSettings } from "../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import {
  createEnableOperation,
  createInstallOperation,
  createReinstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx } from "./mcp-plugin-seed.ts";

/** One version of plugin `hello`: its `.mcp.json` servers and its manifest's. */
interface PluginDeclaration {
  readonly version: string;
  readonly mcpJson: Readonly<Record<string, unknown>>;
  readonly manifestServers?: Readonly<Record<string, unknown>>;
}

const ROOTED_V1 = { command: "node", args: ["v1.js"] };
const ROOTED_V2 = {
  command: "${CLAUDE_PLUGIN_ROOT}/bin/server-v2",
  args: ["--data", "${CLAUDE_PLUGIN_DATA}/db"],
  env: { HOME_COPY: "${HOME}" },
};
const LIVE = { type: "ws", url: "wss://mcp.example.com/ws" };
const EXTRA = { command: "python", args: ["-m", "extra"] };

const ADDED = { type: "http", url: "https://mcp.example.com/${MREC_PATH}" };

const VERSION_1: PluginDeclaration = {
  version: "1.0.0",
  mcpJson: { rooted: ROOTED_V1, live: LIVE, broken: { command: 5 } },
  manifestServers: { extra: EXTRA, rooted: ROOTED_V2 },
};

// A declaration with no blocked server, so the strict install gate admits it.
const CLEAN_1: PluginDeclaration = {
  version: "1.0.0",
  mcpJson: { rooted: ROOTED_V2 },
  manifestServers: { extra: EXTRA },
};

// 2.0.0 drops `live` and `extra`, adds `added`, and puts `rooted` back to v1.
const VERSION_2: PluginDeclaration = {
  version: "2.0.0",
  mcpJson: { added: ADDED, rooted: ROOTED_V1 },
};

/** Writes plugin `hello` at `declaration` into the path marketplace `mp-src`. */
async function writePlugin(cwd: string, declaration: PluginDeclaration): Promise<string> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "hello",
      version: declaration.version,
      ...(declaration.manifestServers !== undefined && {
        mcpServers: declaration.manifestServers,
      }),
    }),
  );
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    JSON.stringify({ mcpServers: declaration.mcpJson }),
  );
  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "hello", source: "./plugins/hello", version: declaration.version }],
    }),
  );
  return pluginRoot;
}

/** Seeds `hello` at `declaration` and records marketplace `mp` at project scope. */
async function seedProject(cwd: string, declaration: PluginDeclaration): Promise<string> {
  const pluginRoot = await writePlugin(cwd, declaration);
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        marketplaceRoot: path.join(cwd, "mp-src"),
        plugins: {},
      },
    },
  });
  return pluginRoot;
}

/** The saved project-scope record of `hello@mp`, read back from state.json. */
async function savedRecord(cwd: string): Promise<Record<string, unknown>> {
  const state = JSON.parse(await readFile(locationsFor("project", cwd).stateJsonPath, "utf8")) as {
    marketplaces: Record<string, { plugins: Record<string, Record<string, unknown>> }>;
  };
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  return record;
}

/** Rewrites the saved record as a build before MREC-01 left it: no recorded servers. */
async function dropRecordedServers(cwd: string): Promise<void> {
  const locations = locationsFor("project", cwd);
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  delete record.mcpServerConfigs;
  await saveState(locations.extensionRoot, state);
}

function operations() {
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  return {
    hooksRouting,
    completionCache,
    install: createInstallOperation(hooksRouting, completionCache),
    setPluginEnabled: createEnableOperation(hooksRouting),
    reinstall: createReinstallOperation(hooksRouting, completionCache),
    updatePlugins: createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
  };
}

const AT_PROJECT = { scope: "project", marketplace: "mp", plugin: "hello" } as const;
const UPDATE_TARGET = { kind: "plugin", plugin: "hello", marketplace: "mp" } as const;
const CLEAN_1_RECORDED = [
  { name: "rooted", config: ROOTED_V2 },
  { name: "extra", config: EXTRA },
];
const VERSION_2_RECORDED = [
  { name: "added", config: ADDED },
  { name: "rooted", config: ROOTED_V1 },
];

test("MREC-01 / D-MB-04: an install records every declared server in merge order, unexpanded, the blocked one included", async () => {
  await withHermeticEnvironment("mcp-server-records-install-", async ({ cwd, home }) => {
    // arrange
    const pluginRoot = await seedProject(cwd, VERSION_1);
    const locations = locationsFor("project", cwd);
    const { install } = operations();

    // act
    await install({ ...makeCtx().session, ...AT_PROJECT, cwd, partial: true });
    const record = await savedRecord(cwd);
    const adapterFile = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
      mcpServers: Record<string, { command?: unknown }>;
    };

    // assert
    const recordedText = JSON.stringify(record.mcpServerConfigs);
    assert.deepStrictEqual(
      {
        mcpServerConfigs: record.mcpServerConfigs,
        hasBundleFlag: Object.hasOwn(record, "mcpBundle"),
        hasCompatibilityBasis: Object.hasOwn(record, "compatibilityBasis"),
        unsupported: (record.compatibility as { unsupported: unknown }).unsupported,
        holdsPluginRoot: recordedText.includes(pluginRoot),
        holdsDataDir: recordedText.includes(locations.dataRoot),
        holdsHome: recordedText.includes(home),
        stagedRootedCommand: adapterFile.mcpServers.plugin_hello_rooted_?.command,
      },
      {
        mcpServerConfigs: [
          { name: "rooted", config: ROOTED_V2 },
          { name: "live", config: LIVE },
          { name: "extra", config: EXTRA },
        ],
        hasBundleFlag: false,
        hasCompatibilityBasis: false,
        unsupported: ["mcpServers"],
        holdsPluginRoot: false,
        holdsDataDir: false,
        holdsHome: false,
        // The mcp phase did expand the staged entry, so the record's literal
        // `${CLAUDE_PLUGIN_ROOT}` shows that it left the resolver's configs
        // unchanged and the record read them before substitution.
        stagedRootedCommand: path.join(pluginRoot, "bin", "server-v2"),
      },
    );
  });
});

test("MREC-01: an update records the new version's servers, dropping and adding them", async () => {
  await withHermeticEnvironment("mcp-server-records-update-", async ({ cwd }) => {
    // arrange
    await seedProject(cwd, VERSION_1);
    const { install, updatePlugins } = operations();
    await install({ ...makeCtx().session, ...AT_PROJECT, cwd, partial: true });
    await writePlugin(cwd, VERSION_2);

    // act
    await updatePlugins({ ...makeCtx().session, scope: "project", cwd, target: UPDATE_TARGET });
    const record = await savedRecord(cwd);

    // assert
    assert.deepStrictEqual(
      { version: record.version, mcpServerConfigs: record.mcpServerConfigs },
      { version: "2.0.0", mcpServerConfigs: VERSION_2_RECORDED },
    );
  });
});

test("MREC-01: enabling a disabled plugin records its servers on a record that lacked them", async () => {
  await withHermeticEnvironment("mcp-server-records-enable-", async ({ cwd }) => {
    // arrange
    await seedProject(cwd, CLEAN_1);
    const { install, setPluginEnabled } = operations();
    await install({ ...makeCtx().session, ...AT_PROJECT, cwd });
    await setPluginEnabled({ ...makeCtx().session, ...AT_PROJECT, cwd, enable: false });
    await dropRecordedServers(cwd);

    // act
    await setPluginEnabled({ ...makeCtx().session, ...AT_PROJECT, cwd, enable: true });
    const record = await savedRecord(cwd);

    // assert
    assert.deepStrictEqual(
      { enabled: record.enabled, mcpServerConfigs: record.mcpServerConfigs },
      { enabled: true, mcpServerConfigs: CLEAN_1_RECORDED },
    );
  });
});

test("MREC-01: updating a disabled plugin records the new version's servers without enabling it", async () => {
  await withHermeticEnvironment("mcp-server-records-disabled-update-", async ({ cwd }) => {
    // arrange
    await seedProject(cwd, CLEAN_1);
    const { install, setPluginEnabled, updatePlugins } = operations();
    await install({ ...makeCtx().session, ...AT_PROJECT, cwd });
    await setPluginEnabled({ ...makeCtx().session, ...AT_PROJECT, cwd, enable: false });
    await writePlugin(cwd, VERSION_2);

    // act
    await updatePlugins({ ...makeCtx().session, scope: "project", cwd, target: UPDATE_TARGET });
    const record = await savedRecord(cwd);

    // assert
    assert.deepStrictEqual(
      {
        enabled: record.enabled,
        version: record.version,
        mcpServerConfigs: record.mcpServerConfigs,
      },
      { enabled: false, version: "2.0.0", mcpServerConfigs: VERSION_2_RECORDED },
    );
  });
});

test("MREC-01: a reinstall records the servers on a record that lacked them", async () => {
  await withHermeticEnvironment("mcp-server-records-reinstall-", async ({ cwd }) => {
    // arrange
    await seedProject(cwd, CLEAN_1);
    const { install, reinstall } = operations();
    await install({ ...makeCtx().session, ...AT_PROJECT, cwd });
    await dropRecordedServers(cwd);

    // act
    await reinstall({ ...makeCtx().session, ...AT_PROJECT, cwd });
    const record = await savedRecord(cwd);

    // assert
    assert.deepStrictEqual(record.mcpServerConfigs, CLEAN_1_RECORDED);
  });
});

test("MREC-01: an import that installs a plugin records its servers", async () => {
  await withHermeticEnvironment("mcp-server-records-import-", async ({ cwd }) => {
    // arrange
    await seedProject(cwd, CLEAN_1);
    await mkdir(path.join(cwd, ".claude"), { recursive: true });
    await writeFile(
      path.join(cwd, ".claude", "settings.json"),
      JSON.stringify({
        extraKnownMarketplaces: { mp: { source: { source: "directory", path: "./mp-src" } } },
        enabledPlugins: { "hello@mp": true },
      }),
    );
    const { hooksRouting, completionCache } = operations();
    const imported = makeCtx();

    // act
    await importClaudeSettings({
      ...imported.session,
      cwd,
      selectedScopes: ["project"],
      hooksRouting,
      completionCache,
    });
    const record = await savedRecord(cwd);

    // assert
    assert.deepStrictEqual(record.mcpServerConfigs, CLEAN_1_RECORDED);
  });
});
