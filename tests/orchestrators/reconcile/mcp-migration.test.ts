// Owner suite for orchestrators/reconcile/mcp-migration.ts.
//
// AMIG-01 / AMIG-02 / AMIG-03: the load-time move of an installed plugin's MCP
// servers out of the legacy `mcp.json`. Each case seeds its own temporary
// project tree: a path marketplace whose plugin declares MCP servers, a record
// literal saved with `saveState` and checked with `satisfies`, and an
// `mcp.json` literal shaped like the released builds wrote it (declared-name
// keys, every field passed through, the `_piClaudeMarketplace` marker). The
// write-order cases wrap the real bridge functions and `tx.save()` in one
// recording operations object, so the log is the order of the real writes.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";

import {
  commitPreparedMcp,
  prepareStageMcpServers,
  removeLegacyMcpEntries,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { migrateLegacyMcpEntries } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { McpMigrationOperations } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts";
import type { McpMigrationInput } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

const RECORDED_AT = "2026-01-01T00:00:00.000Z";
const MOVED_AT = "2026-02-03T04:05:06.000Z";

interface Scope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
}

async function createProjectScope(t: TestContext, label: string): Promise<Scope> {
  const { cwd } = await createHermeticEnvironment(t, `mcp-migration-${label}-`);
  const locations = locationsFor("project", cwd);
  await mkdir(locations.scopeRoot, { recursive: true });
  return { cwd, locations };
}

interface PluginSeed {
  readonly servers: Readonly<Record<string, unknown>>;
  /** `.lsp.json` makes the plugin resolve partially-available, not installable. */
  readonly lsp?: boolean;
}

/** Writes path marketplace `mp` at `<cwd>/mp-src` holding each plugin, and returns its paths. */
async function seedMarketplace(
  cwd: string,
  plugins: Readonly<Record<string, PluginSeed>>,
): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  for (const [plugin, seed] of Object.entries(plugins)) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version: "1.0.0" }),
    );
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: seed.servers }),
    );
    if (seed.lsp === true) {
      await writeFile(
        path.join(pluginRoot, ".lsp.json"),
        JSON.stringify({ ts: { command: "ts" } }),
      );
    }
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: Object.keys(plugins).map((plugin) => ({
        name: plugin,
        source: `./plugins/${plugin}`,
        version: "1.0.0",
      })),
    }),
  );
  return { marketplaceRoot, manifestPath };
}

function pluginRecord(
  marketplaceRoot: string,
  plugin: string,
  mcpServers: readonly string[],
  enabled = true,
): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: path.join(marketplaceRoot, "plugins", plugin),
    compatibility: { installable: true, notes: [], supported: ["mcpServers"], unsupported: [] },
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: [...mcpServers],
      hooks: [],
      workflows: [],
    },
    enabled,
    provenance: "explicit",
    installedAt: RECORDED_AT,
    updatedAt: RECORDED_AT,
  } satisfies PluginRecord;
}

function stateWith(
  cwd: string,
  marketplace: { readonly marketplaceRoot: string; readonly manifestPath: string },
  plugins: Readonly<Record<string, PluginRecord>>,
): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath: marketplace.manifestPath,
        marketplaceRoot: marketplace.marketplaceRoot,
        plugins: { ...plugins },
      },
    },
  } satisfies ExtensionState;
}

async function seedState(locations: ScopedLocations, state: ExtensionState): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, state);
}

/** One released-build `mcp.json` entry: the declared fields plus the owner marker. */
function legacyEntry(
  plugin: string,
  fields: Readonly<Record<string, unknown>> = { command: "node", args: ["v1.js"] },
  marketplace = "mp",
): Record<string, unknown> {
  return { ...fields, _piClaudeMarketplace: { plugin, marketplace } };
}

async function writeLegacy(
  locations: ScopedLocations,
  servers: Readonly<Record<string, unknown>>,
): Promise<string> {
  const bytes = `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`;
  await writeFile(locations.mcpJsonPath, bytes);
  return bytes;
}

function migrationInput(cwd: string): McpMigrationInput {
  return { scope: "project", cwd, plan: undefined, rows: [], notices: [] };
}

/** The real bridge writes and `tx.save()`, each logged as it runs, with a fixed clock. */
function recordingOperations(log: string[]): McpMigrationOperations {
  return {
    prepareStageMcpServers: async (input) => {
      log.push(`prepare ${input.pluginName}@${input.marketplaceName}`);
      return prepareStageMcpServers(input);
    },
    commitPreparedMcp: async (prepared) => {
      log.push("commit");
      return commitPreparedMcp(prepared);
    },
    saveState: async (tx) => {
      log.push("saveState");
      await tx.save();
    },
    removeLegacyMcpEntries: async (input) => {
      log.push(`removeLegacy ${input.pluginName}@${input.marketplaceName}`);
      return removeLegacyMcpEntries(input);
    },
    now: () => new Date(MOVED_AT),
  };
}

/** The `mcp-adapter.json` a fresh install of `plugin` writes for `servers`, with their declared fields. */
function freshAdapterText(
  locations: ScopedLocations,
  marketplaceRoot: string,
  servers: Readonly<
    Record<string, { readonly plugin: string; readonly fields: Readonly<Record<string, unknown>> }>
  >,
): string {
  const mcpServers: Record<string, unknown> = {};
  for (const [key, { plugin, fields }] of Object.entries(servers)) {
    mcpServers[key] = {
      ...fields,
      env: {
        CLAUDE_PLUGIN_ROOT: path.join(marketplaceRoot, "plugins", plugin),
        CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", plugin),
      },
      directTools: "search",
      toolPrefix: "mcp",
      _piClaudeMarketplace: { plugin, marketplace: "mp" },
    };
  }

  return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
}

async function holdStateLock(t: TestContext, locations: ScopedLocations): Promise<void> {
  const release = await lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });
  t.after(async () => {
    await release();
  });
}

interface NotMovableSeed {
  /** The records the scope holds; by default an enabled `hello` that lists `srv`. */
  readonly records?: Readonly<Record<string, PluginRecord>>;
  readonly enabled?: boolean;
  readonly markerMarketplace?: string;
  readonly manifestMissing?: boolean;
  readonly listedPlugin?: string;
  readonly lsp?: boolean;
  readonly legacyName?: string;
}

/**
 * Seeds marketplace `mp` with one plugin declaring `srv`, the scope's record of
 * `hello`, and one `hello` legacy entry, each varied by `seed`. Returns the
 * `mcp.json` bytes.
 */
async function seedNotMovable({ cwd, locations }: Scope, seed: NotMovableSeed): Promise<string> {
  const marketplace = await seedMarketplace(cwd, {
    [seed.listedPlugin ?? "hello"]: {
      servers: { srv: { command: "srv" } },
      lsp: seed.lsp ?? false,
    },
  });
  const manifestPath =
    seed.manifestMissing === true
      ? path.join(cwd, "nowhere", "marketplace.json")
      : marketplace.manifestPath;
  const records = seed.records ?? {
    hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"], seed.enabled ?? true),
  };
  await seedState(locations, stateWith(cwd, { ...marketplace, manifestPath }, records));
  return writeLegacy(locations, {
    [seed.legacyName ?? "srv"]: legacyEntry("hello", { command: "node" }, seed.markerMarketplace),
  });
}

describe("migrateLegacyMcpEntries", () => {
  for (const { shape, writeMcpJson } of [
    { shape: "no mcp.json", writeMcpJson: async (): Promise<void> => {} },
    {
      shape: "an mcp.json with only marker-less entries",
      writeMcpJson: async (locations: ScopedLocations): Promise<void> => {
        await writeLegacy(locations, { mine: { command: "x" } });
      },
    },
    {
      shape: "an empty mcpServers map",
      writeMcpJson: async (locations: ScopedLocations): Promise<void> => {
        await writeLegacy(locations, {});
      },
    },
  ]) {
    test(`AMIG-01: ${shape} takes no lock, writes nothing and calls no operation`, async (t) => {
      // arrange
      const { cwd, locations } = await createProjectScope(t, "no-owner");
      const marketplace = await seedMarketplace(cwd, { hello: { servers: { srv: {} } } });
      await seedState(
        locations,
        stateWith(cwd, marketplace, {
          hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"]),
        }),
      );
      await writeMcpJson(locations);
      await holdStateLock(t, locations);
      const treeBefore = await retryTree(locations.scopeRoot);
      const log: string[] = [];
      const input = migrationInput(cwd);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(
        { rows: input.rows, notices: input.notices },
        { rows: [], notices: [] },
      );
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), treeBefore);
      assert.deepStrictEqual(log, []);
    });
  }

  test("AMIG-01: a legacy owner in a scope with no state.json creates nothing and calls no operation", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "no-state");
    await writeLegacy(locations, { srv: legacyEntry("hello") });
    const treeBefore = await retryTree(locations.scopeRoot);
    const log: string[] = [];
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(treeBefore, ["mcp.json"]);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), treeBefore);
    assert.deepStrictEqual({ rows: input.rows, notices: input.notices }, { rows: [], notices: [] });
    assert.deepStrictEqual(log, []);
  });

  test("AMIG-01: a movable owner is prepared, committed, then removed from mcp.json, with its stage notices", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "move");
    const server = { command: "node", args: ["${PI_CM_MIGRATION_UNSET}"] };
    const marketplace = await seedMarketplace(cwd, { hello: { servers: { srv: server } } });
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"]),
      }),
    );
    const stateBytes = await readFile(locations.stateJsonPath);
    await writeLegacy(locations, {
      srv: legacyEntry("hello", { command: "node", args: ["edited.js"], approveTools: true }),
      mine: { command: "my-server" },
    });
    const log: string[] = [];
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(input.rows, [
      {
        kind: "moved",
        scope: "project",
        plugin: "hello",
        marketplace: "mp",
        from: "srv",
        to: "plugin_hello_srv_",
      },
    ]);
    assert.deepStrictEqual(input.notices, [
      {
        kind: "variables-missing",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_srv_",
        names: ["PI_CM_MIGRATION_UNSET"],
      },
    ]);
    assert.strictEqual(
      await readFile(locations.mcpAdapterJsonPath, "utf8"),
      freshAdapterText(locations, marketplace.marketplaceRoot, {
        plugin_hello_srv_: { plugin: "hello", fields: server },
      }),
    );
    assert.strictEqual(
      await readFile(locations.mcpJsonPath, "utf8"),
      '{\n  "mcpServers": {\n    "mine": {\n      "command": "my-server"\n    }\n  }\n}\n',
    );
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
    assert.deepStrictEqual(log, ["prepare hello@mp", "commit", "removeLegacy hello@mp"]);
  });

  test("AMIG-01: records that lack a declared server get the staged names, saved once between the adapter writes and the removals", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "record-update");
    const servers = { web: { command: "web" }, srv: { command: "srv" } };
    const marketplace = await seedMarketplace(cwd, {
      hello: { servers },
      beta: { servers: { "beta-srv": { command: "srv" } } },
    });
    const { marketplaceRoot } = marketplace;
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        hello: pluginRecord(marketplaceRoot, "hello", ["srv"]),
        beta: pluginRecord(marketplaceRoot, "beta", []),
      }),
    );
    await writeLegacy(locations, { srv: legacyEntry("hello"), "beta-srv": legacyEntry("beta") });
    const log: string[] = [];
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(log, [
      "prepare beta@mp",
      "commit",
      "prepare hello@mp",
      "commit",
      "saveState",
      "removeLegacy beta@mp",
      "removeLegacy hello@mp",
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins, {
      hello: {
        ...pluginRecord(marketplaceRoot, "hello", ["web", "srv"]),
        updatedAt: MOVED_AT,
      },
      beta: { ...pluginRecord(marketplaceRoot, "beta", ["beta-srv"]), updatedAt: MOVED_AT },
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
  });

  test("AMIG-01: the default operations write the record with the current time", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "default-operations");
    const marketplace = await seedMarketplace(cwd, {
      hello: { servers: { srv: { command: "srv" } } },
    });
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        hello: pluginRecord(marketplace.marketplaceRoot, "hello", []),
      }),
    );
    await writeLegacy(locations, { srv: legacyEntry("hello") });
    const before = Date.now();

    // act
    await migrateLegacyMcpEntries(migrationInput(cwd));

    // assert
    const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"];
    const movedAt = Date.parse(record?.updatedAt ?? "");
    assert.deepStrictEqual(record, {
      ...pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"]),
      updatedAt: new Date(movedAt).toISOString(),
    });
    assert.ok(movedAt >= before && movedAt <= Date.now());
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
  });

  for (const { owner, seed } of [
    {
      owner: "an owner with no record",
      seed: (scope: Scope) => seedNotMovable(scope, { records: {} }),
    },
    {
      owner: "an owner whose marketplace is not recorded",
      seed: (scope: Scope) => seedNotMovable(scope, { markerMarketplace: "elsewhere" }),
    },
    {
      owner: "an owner whose marker names an inherited marketplace key",
      seed: (scope: Scope) => seedNotMovable(scope, { markerMarketplace: "constructor" }),
    },
    {
      owner: "a disabled record",
      seed: (scope: Scope) => seedNotMovable(scope, { enabled: false }),
    },
    {
      owner: "a source whose manifest cannot be read",
      seed: (scope: Scope) => seedNotMovable(scope, { manifestMissing: true }),
    },
    {
      owner: "a plugin the manifest does not list",
      seed: (scope: Scope) => seedNotMovable(scope, { listedPlugin: "other" }),
    },
    {
      owner: "a source that resolves non-installable",
      seed: (scope: Scope) => seedNotMovable(scope, { lsp: true }),
    },
    {
      owner: "a legacy name the source does not declare",
      seed: (scope: Scope) => seedNotMovable(scope, { legacyName: "gone" }),
    },
  ]) {
    test(`AMIG-01: ${owner} calls no operation and keeps mcp.json byte-identical`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "not-movable");
      const legacyBytes = await seed(scope);
      const log: string[] = [];
      const input = migrationInput(scope.cwd);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(log, []);
      assert.deepStrictEqual(
        { rows: input.rows, notices: input.notices },
        { rows: [], notices: [] },
      );
      assert.strictEqual(await readFile(scope.locations.mcpJsonPath, "utf8"), legacyBytes);
      assert.deepStrictEqual(await retryTree(scope.locations.scopeRoot), [
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/state.json",
      ]);
    });
  }

  test("AMIG-01: a prepare failure for one owner is a stopped row with a redacted detail, and the next owner still moves", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "prepare-throws");
    const marketplace = await seedMarketplace(cwd, {
      beta: { servers: { "beta-srv": { command: "srv" } } },
      hello: { servers: { srv: { command: "srv" } } },
    });
    const { marketplaceRoot } = marketplace;
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        beta: pluginRecord(marketplaceRoot, "beta", ["beta-srv"]),
        hello: pluginRecord(marketplaceRoot, "hello", ["srv"]),
      }),
    );
    await writeLegacy(locations, { "beta-srv": legacyEntry("beta"), srv: legacyEntry("hello") });
    const log: string[] = [];
    const recording = recordingOperations(log);
    const operations: McpMigrationOperations = {
      ...recording,
      prepareStageMcpServers: async (stageInput) => {
        if (stageInput.pluginName === "beta") {
          throw new Error(
            `cannot read ${path.join(cwd, "mp-src", "plugins", "beta", ".mcp.json")}`,
          );
        }

        return recording.prepareStageMcpServers(stageInput);
      },
    };
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, operations);

    // assert
    assert.deepStrictEqual(input.rows, [
      { kind: "stopped", scope: "project", detail: "beta@mp: cannot read .mcp.json" },
      {
        kind: "moved",
        scope: "project",
        plugin: "hello",
        marketplace: "mp",
        from: "srv",
        to: "plugin_hello_srv_",
      },
    ]);
    assert.deepStrictEqual(log, ["prepare hello@mp", "commit", "removeLegacy hello@mp"]);
    assert.strictEqual(
      await readFile(locations.mcpJsonPath, "utf8"),
      `${JSON.stringify({ mcpServers: { "beta-srv": legacyEntry("beta") } }, null, 2)}
`,
    );
  });

  test("AMIG-01: a legacy removal failure for one owner is a stopped row, and the next owner is still removed", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "remove-throws");
    const marketplace = await seedMarketplace(cwd, {
      beta: { servers: { "beta-srv": { command: "srv" } } },
      hello: { servers: { srv: { command: "srv" } } },
    });
    const { marketplaceRoot } = marketplace;
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        beta: pluginRecord(marketplaceRoot, "beta", ["beta-srv"]),
        hello: pluginRecord(marketplaceRoot, "hello", ["srv"]),
      }),
    );
    await writeLegacy(locations, { "beta-srv": legacyEntry("beta"), srv: legacyEntry("hello") });
    const log: string[] = [];
    const recording = recordingOperations(log);
    const operations: McpMigrationOperations = {
      ...recording,
      removeLegacyMcpEntries: async (removeInput) => {
        if (removeInput.pluginName === "beta") {
          throw new Error("mcp.json is busy");
        }

        return recording.removeLegacyMcpEntries(removeInput);
      },
    };
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, operations);

    // assert
    assert.deepStrictEqual(input.rows, [
      { kind: "stopped", scope: "project", detail: "beta@mp: mcp.json is busy" },
      {
        kind: "moved",
        scope: "project",
        plugin: "hello",
        marketplace: "mp",
        from: "srv",
        to: "plugin_hello_srv_",
      },
    ]);
    assert.strictEqual(
      await readFile(locations.mcpJsonPath, "utf8"),
      `${JSON.stringify({ mcpServers: { "beta-srv": legacyEntry("beta") } }, null, 2)}
`,
    );
  });

  test("AFILE-02: an unreadable mcp-adapter.json stops the owner's move, so its legacy entries and record stay", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "adapter-unreadable");
    const marketplace = await seedMarketplace(cwd, {
      hello: { servers: { srv: { command: "srv" } } },
    });
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        hello: pluginRecord(marketplace.marketplaceRoot, "hello", []),
      }),
    );
    const stateBytes = await readFile(locations.stateJsonPath);
    const legacyBytes = await writeLegacy(locations, { srv: legacyEntry("hello") });
    await writeFile(locations.mcpAdapterJsonPath, "{ broken");
    const log: string[] = [];
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(input.rows, [
      {
        kind: "stopped",
        scope: "project",
        detail: "hello@mp: MCP config mcp-adapter.json is not valid JSONC; it was left unchanged.",
      },
    ]);
    assert.deepStrictEqual(input.notices, []);
    assert.deepStrictEqual(log, ["prepare hello@mp"]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), legacyBytes);
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{ broken");
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
  });
});
