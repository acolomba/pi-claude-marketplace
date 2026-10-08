// Owner suite for orchestrators/reconcile/mcp-migration.ts.
//
// AMIG-01 / AMIG-02 / AMIG-03: the load-time move of an installed plugin's MCP
// servers out of the legacy `mcp.json`. Each case seeds its own temporary
// project tree: a path marketplace whose plugin declares MCP servers, a record
// literal saved with `saveState` and checked with `satisfies`, and an
// `mcp.json` literal shaped like the released builds wrote it (declared-name
// keys, every field passed through, the `_piClaudeMarketplace` marker). The
// write-order cases wrap the real bridge functions and `tx.save()` in one
// recording operations object, so the log is the order of the real writes;
// an empty log proves that a left-in-place owner was never written (AMIG-04).
// The git-source cases lay a plugin tree out under the case's clone cache by
// hand: no git process and no network module runs (NFR-5).

import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";

import {
  commitPreparedMcp,
  prepareStageMcpServers,
  removeLegacyMcpEntries,
  removeProjectDisableStubs,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/index.ts";
import {
  canonicalCloneUrl,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { migrateLegacyMcpEntries } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { McpMigrationOperations } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts";
import type {
  McpMigrationInput,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

const RECORDED_AT = "2026-01-01T00:00:00.000Z";
const MOVED_AT = "2026-02-03T04:05:06.000Z";

interface Scope {
  readonly cwd: string;
  readonly home: string;
  readonly locations: ScopedLocations;
}

async function createProjectScope(t: TestContext, label: string): Promise<Scope> {
  const { cwd, home } = await createHermeticEnvironment(t, `mcp-migration-${label}-`);
  const locations = locationsFor("project", cwd);
  await mkdir(locations.scopeRoot, { recursive: true });
  return { cwd, home, locations };
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
  scope: MarketplaceRecord["scope"] = "project",
): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope,
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

function migrationInput(
  cwd: string,
  plan?: ReconcilePlan,
  reason?: McpMigrationInput["reason"],
): McpMigrationInput {
  return { scope: "project", cwd, plan, reason, rows: [], notices: [] };
}

/** The project plan with `buckets` set; every other bucket is empty. */
function planWith(buckets: Partial<Omit<ReconcilePlan, "scope">>): ReconcilePlan {
  return { ...emptyReconcilePlan("project"), ...buckets };
}

const HELLO_PLANNED = { scope: "project", plugin: "hello", marketplace: "mp" } as const;

/** The row of an owner `hello` whose one legacy entry `srv` stays in place. */
function helloRow<Kind extends "unowned" | "not-listed" | "source-unreadable">(
  kind: Kind,
  marketplace = "mp",
): {
  readonly kind: Kind;
  readonly scope: "project";
  readonly plugin: "hello";
  readonly marketplace: string;
  readonly servers: readonly string[];
} {
  return { kind, scope: "project", plugin: "hello", marketplace, servers: ["srv"] };
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
    removeProjectDisableStubs: async (cwd, owners) => {
      log.push(
        `removeProjectStubs ${owners.map((owner) => `${owner.pluginName}@${owner.marketplaceName}`).join(" ")}`,
      );
      return removeProjectDisableStubs(cwd, owners);
    },
    removeLegacyMcpEntries: async (input) => {
      log.push(`removeLegacy ${input.pluginName}@${input.marketplaceName}`);
      return removeLegacyMcpEntries(input);
    },
    now: () => new Date(MOVED_AT),
  };
}

/** A file's inode, modification time and bytes, or `absent`. */
async function fileIdentity(filePath: string): Promise<string> {
  try {
    const [stats, bytes] = await Promise.all([
      stat(filePath, { bigint: true }),
      readFile(filePath),
    ]);
    return `${stats.ino}:${stats.mtimeNs}:${bytes.toString("base64")}`;
  } catch {
    return "absent";
  }
}

type FailingOperation = "commitPreparedMcp" | "saveState" | "removeLegacyMcpEntries";

/**
 * AMIG-02: the real bridge writes and `tx.save()` with a fixed clock, logging
 * the basename of the file each call changed (bytes or inode), in call order.
 * `failOnce` throws instead of the named operation's first call.
 */
function writeRecordingOperations(
  locations: ScopedLocations,
  log: string[],
  failOnce?: FailingOperation,
): McpMigrationOperations {
  let failed = false;
  async function observed<T>(
    operation: FailingOperation,
    filePath: string,
    run: () => Promise<T>,
  ): Promise<T> {
    if (operation === failOnce && !failed) {
      failed = true;
      throw new Error(`injected ${operation} failure`);
    }

    const before = await fileIdentity(filePath);
    const result = await run();
    if ((await fileIdentity(filePath)) !== before) {
      log.push(path.basename(filePath));
    }

    return result;
  }

  return {
    prepareStageMcpServers,
    commitPreparedMcp: (prepared) =>
      observed("commitPreparedMcp", locations.mcpAdapterJsonPath, () =>
        commitPreparedMcp(prepared),
      ),
    saveState: (tx) => observed("saveState", locations.stateJsonPath, () => tx.save()),
    removeProjectDisableStubs,
    removeLegacyMcpEntries: (removeInput) =>
      observed("removeLegacyMcpEntries", locations.mcpJsonPath, () =>
        removeLegacyMcpEntries(removeInput),
      ),
    now: () => new Date(MOVED_AT),
  };
}

const WS_SERVER = { type: "ws", url: "wss://example.test/ws" };

/**
 * Seeds `hello` declaring `srv` and the unsupported `live`, recorded and left
 * in `mcp.json` with both, so its move drops `live` and saves the record.
 */
async function seedDroppedServerOwner({ cwd, locations }: Scope): Promise<string> {
  const marketplace = await seedMarketplace(cwd, {
    hello: { servers: { srv: { command: "srv" }, live: WS_SERVER } },
  });
  await seedState(
    locations,
    stateWith(cwd, marketplace, {
      hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv", "live"]),
    }),
  );
  await writeLegacy(locations, {
    srv: legacyEntry("hello"),
    live: legacyEntry("hello", WS_SERVER),
  });
  return marketplace.marketplaceRoot;
}

/** Seeds `hello` declaring `srv`, recorded with it, and its one legacy entry. */
async function seedPlainMoveOwner({ cwd, locations }: Scope): Promise<string> {
  const marketplace = await seedMarketplace(cwd, {
    hello: { servers: { srv: { command: "srv" } } },
  });
  await seedState(
    locations,
    stateWith(cwd, marketplace, {
      hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"]),
    }),
  );
  await writeLegacy(locations, { srv: legacyEntry("hello") });
  return marketplace.marketplaceRoot;
}

/** The scope's three files as text with the tree's own paths replaced, so two trees compare. */
async function scopeTexts({ cwd, home, locations }: Scope): Promise<readonly string[]> {
  const files = [locations.mcpJsonPath, locations.mcpAdapterJsonPath, locations.stateJsonPath];
  const texts = await Promise.all(files.map((file) => readFile(file, "utf8")));
  return texts.map((text) => text.replaceAll(cwd, "<cwd>").replaceAll(home, "<home>"));
}

/** The server keys of an MCP config file. */
async function serverKeys(filePath: string): Promise<readonly string[]> {
  const config = JSON.parse(await readFile(filePath, "utf8")) as {
    readonly mcpServers: Readonly<Record<string, unknown>>;
  };
  return Object.keys(config.mcpServers);
}

const EMPTY_MCP_JSON = '{\n  "mcpServers": {}\n}\n';

const HELLO_MOVED = {
  kind: "moved",
  scope: "project",
  plugin: "hello",
  marketplace: "mp",
  from: "srv",
  to: "plugin_hello_srv_",
} as const;

/** The removed row of `hello`'s legacy `server` for `cause`. */
function helloRemoved(
  server: string,
  cause: "not-declared" | "disabled" | "unsupported-feature" | "malformed",
  feature?: string,
): Record<string, unknown> {
  return {
    kind: "removed",
    scope: "project",
    plugin: "hello",
    marketplace: "mp",
    server,
    cause,
    ...(feature !== undefined && { feature }),
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

const GIT_URL = "https://example.test/hello.git";
const MANIFEST_SHA = "1111111111111111111111111111111111111111";
const RECORDED_SHA = "2222222222222222222222222222222222222222";

interface GitOwnerSeed {
  /** The record's `resolvedSha`; absent for a record that predates it. */
  readonly recordedSha?: string;
  /** Whether the manifest pins `MANIFEST_SHA`. */
  readonly pinned: boolean;
  /** `warm` lays the plugin out under the recorded-sha clone; `headless-mirror` leaves a mirror without `.git/HEAD`. */
  readonly cache: "warm" | "cold" | "headless-mirror";
}

/**
 * Seeds marketplace `mp` whose `hello` has a `url` source declaring `srv`,
 * the scope's enabled record of it, and its legacy entry. Returns the clone
 * directory the recorded sha names and the `mcp.json` bytes.
 */
async function seedGitOwner(
  { cwd, locations }: Scope,
  seed: GitOwnerSeed,
): Promise<{ readonly cloneDir: string; readonly legacyBytes: string }> {
  const source = seed.pinned
    ? { source: "url", url: GIT_URL, sha: MANIFEST_SHA }
    : { source: "url", url: GIT_URL };
  const parsed = parsePluginSource(source);
  assert.strictEqual(parsed.kind, "url");
  const cloneUrl = canonicalCloneUrl(parsed);
  const cloneDir = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, RECORDED_SHA));
  if (seed.cache === "warm") {
    await mkdir(path.join(cloneDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(cloneDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "hello", version: "1.0.0" }),
    );
    await writeFile(
      path.join(cloneDir, ".mcp.json"),
      JSON.stringify({ mcpServers: { srv: { command: "srv" } } }),
    );
  } else if (seed.cache === "headless-mirror") {
    await mkdir(await locations.pluginCloneDir(pluginMirrorKey(cloneUrl)), { recursive: true });
  }

  const marketplaceRoot = path.join(cwd, "mp-src");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "hello", source, version: "1.0.0" }] }),
  );
  const record = {
    ...pluginRecord(marketplaceRoot, "hello", ["srv"]),
    resolvedSource: cloneDir,
    ...(seed.recordedSha !== undefined && { resolvedSha: seed.recordedSha }),
  };
  await seedState(locations, stateWith(cwd, { marketplaceRoot, manifestPath }, { hello: record }));
  const legacyBytes = await writeLegacy(locations, { srv: legacyEntry("hello") });
  return { cloneDir, legacyBytes };
}

/** Seeds movable owners `beta` and `hello` of marketplace `mp`, each with one legacy entry. */
async function seedTwoMovableOwners({ cwd, locations }: Scope): Promise<void> {
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
}

async function writeConfigFile(filePath: string, servers: Record<string, unknown>): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ mcpServers: servers }));
}

/**
 * Seeds a user-scope `hello` declaring `srv`, recorded with it, its one
 * legacy entry in the user `mcp.json`, and the project `mcp-adapter.json`
 * text `projectAdapter`. Returns the user-scope locations.
 */
async function seedUserMoveOwner(cwd: string, projectAdapter: string): Promise<ScopedLocations> {
  const user = locationsFor("user", cwd);
  const marketplace = await seedMarketplace(cwd, {
    hello: { servers: { srv: { command: "srv" } } },
  });
  await seedState(
    user,
    stateWith(
      cwd,
      marketplace,
      { hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"]) },
      "user",
    ),
  );
  await writeLegacy(user, { srv: legacyEntry("hello") });
  const projectAdapterPath = locationsFor("project", cwd).mcpAdapterJsonPath;
  await mkdir(path.dirname(projectAdapterPath), { recursive: true });
  await writeFile(projectAdapterPath, projectAdapter);
  return user;
}

const PROJECT_STUBS_TEXT = '{"mcpServers":{"srv":{"disabled":true},"other":{"disabled":true}}}\n';

const USER_HELLO_MOVED = { ...HELLO_MOVED, scope: "user" } as const;

const BETA_MOVED = {
  kind: "moved",
  scope: "project",
  plugin: "beta",
  marketplace: "mp",
  from: "beta-srv",
  to: "plugin_beta_beta-srv_",
} as const;

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

  for (const { owner, plan, rows } of [
    { owner: "a legacy owner", plan: undefined, rows: [helloRow("unowned")] },
    {
      owner: "an owner the plan installs",
      plan: planWith({ pluginsToInstall: [{ ...HELLO_PLANNED, configSource: "base" }] }),
      rows: [],
    },
  ]) {
    test(`AMIG-04: ${owner} in a scope with no state.json gets its row, with no lock and nothing created`, async (t) => {
      // arrange
      const { cwd, locations } = await createProjectScope(t, "no-state");
      await writeLegacy(locations, { srv: legacyEntry("hello") });
      const treeBefore = await retryTree(locations.scopeRoot);
      const log: string[] = [];
      const input = migrationInput(cwd, plan);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(treeBefore, ["mcp.json"]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), treeBefore);
      assert.deepStrictEqual({ rows: input.rows, notices: input.notices }, { rows, notices: [] });
      assert.deepStrictEqual(log, []);
    });
  }

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

  for (const { owner, seed, rows } of [
    {
      owner: "an owner with no record",
      seed: (scope: Scope) => seedNotMovable(scope, { records: {} }),
      rows: [helloRow("unowned")],
    },
    {
      owner: "an owner whose marketplace is not recorded",
      seed: (scope: Scope) => seedNotMovable(scope, { markerMarketplace: "elsewhere" }),
      rows: [helloRow("unowned", "elsewhere")],
    },
    {
      owner: "an owner whose marker names an inherited marketplace key",
      seed: (scope: Scope) => seedNotMovable(scope, { markerMarketplace: "constructor" }),
      rows: [helloRow("unowned", "constructor")],
    },
    {
      owner: "a source whose manifest cannot be read",
      seed: (scope: Scope) => seedNotMovable(scope, { manifestMissing: true }),
      rows: [helloRow("source-unreadable")],
    },
    {
      owner: "a plugin the manifest does not list",
      seed: (scope: Scope) => seedNotMovable(scope, { listedPlugin: "other" }),
      rows: [helloRow("not-listed")],
    },
  ]) {
    test(`AMIG-01 / AMIG-04: ${owner} calls no operation and keeps mcp.json byte-identical`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "not-movable");
      const legacyBytes = await seed(scope);
      const log: string[] = [];
      const input = migrationInput(scope.cwd);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(log, []);
      assert.deepStrictEqual({ rows: input.rows, notices: input.notices }, { rows, notices: [] });
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

  test("AMIG-02: a legacy removal failure after the owner's adapter write is an unfinished row, and the next owner is still removed", async (t) => {
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
      {
        kind: "unfinished",
        scope: "project",
        plugin: "beta",
        marketplace: "mp",
        servers: ["beta-srv"],
        detail: "mcp.json is busy",
      },
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

  test("AMIG-01: an unparseable mcp-adapter.json stops the scope before any write, with one file-unreadable row", async (t) => {
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
      { kind: "file-unreadable", scope: "project", file: "mcp-adapter.json" },
    ]);
    assert.deepStrictEqual(input.notices, []);
    assert.deepStrictEqual(log, []);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), legacyBytes);
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{ broken");
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
  });
  for (const { defect, bytes } of [
    { defect: "invalid JSONC", bytes: "{ broken" },
    { defect: "a non-object mcpServers", bytes: '{ "mcpServers": ["srv"] }\n' },
  ]) {
    test(`AMIG-01: an mcp.json with ${defect} gives one file-unreadable row without a lock or a write`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "legacy-unparseable");
      await seedNotMovable(scope, {});
      await writeFile(scope.locations.mcpJsonPath, bytes);
      await holdStateLock(t, scope.locations);
      const treeBefore = await retryTree(scope.locations.scopeRoot);
      const log: string[] = [];
      const input = migrationInput(scope.cwd);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(input.rows, [
        { kind: "file-unreadable", scope: "project", file: "mcp.json" },
      ]);
      assert.deepStrictEqual(log, []);
      assert.strictEqual(await readFile(scope.locations.mcpJsonPath, "utf8"), bytes);
      assert.deepStrictEqual(await retryTree(scope.locations.scopeRoot), treeBefore);
    });
  }

  test("AMIG-01: an mcp.json read failure other than a config defect propagates", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "legacy-eisdir");
    await mkdir(locations.mcpJsonPath);
    const input = migrationInput(cwd);

    // act & assert
    await assert.rejects(migrateLegacyMcpEntries(input, recordingOperations([])), {
      code: "EISDIR",
    });
    assert.deepStrictEqual(input.rows, []);
  });

  test("AMIG-01: an mcp-adapter.json read failure other than a config defect propagates before any write", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "adapter-eisdir");
    const legacyBytes = await seedNotMovable(scope, {});
    await mkdir(scope.locations.mcpAdapterJsonPath);
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

    // act & assert
    await assert.rejects(migrateLegacyMcpEntries(input, recordingOperations(log)), {
      code: "EISDIR",
    });
    assert.deepStrictEqual({ rows: input.rows, log }, { rows: [], log: [] });
    assert.strictEqual(await readFile(scope.locations.mcpJsonPath, "utf8"), legacyBytes);
  });

  for (const { owner, plan, reason, rows } of [
    {
      owner: "an owner the plan installs",
      plan: planWith({ pluginsToInstall: [{ ...HELLO_PLANNED, configSource: "local" }] }),
      reason: undefined,
      rows: [],
    },
    {
      owner: "an owner the reload's dependency install installs",
      plan: planWith({
        pluginsToDependencyInstall: [
          { ...HELLO_PLANNED, ranges: [], requiredBy: "app@mp", declarers: ["app@mp"] },
        ],
      }),
      reason: "reload",
      rows: [],
    },
    {
      owner: "an owner the dependency install plans at startup",
      plan: planWith({
        pluginsToDependencyInstall: [
          { ...HELLO_PLANNED, ranges: [], requiredBy: "app@mp", declarers: ["app@mp"] },
        ],
      }),
      reason: "startup",
      rows: [helloRow("unowned")],
    },
    {
      owner: "an owner while the plan installs another plugin",
      plan: planWith({
        pluginsToInstall: [
          { ...HELLO_PLANNED, plugin: "beta", configSource: "base" },
          { ...HELLO_PLANNED, marketplace: "other", configSource: "base" },
        ],
      }),
      reason: "reload",
      rows: [helloRow("unowned")],
    },
  ] as const) {
    test(`AMIG-04: ${owner} with no record here gets ${rows.length} unowned row(s) and no write`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "unowned-plan");
      const legacyBytes = await seedNotMovable(scope, { records: {} });
      const log: string[] = [];
      const input = migrationInput(scope.cwd, plan, reason);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual({ rows: input.rows, log }, { rows, log: [] });
      assert.strictEqual(await readFile(scope.locations.mcpJsonPath, "utf8"), legacyBytes);
    });
  }

  for (const { operation, enabled, plan } of [
    {
      operation: "uninstalls",
      enabled: true,
      plan: planWith({ pluginsToUninstall: [HELLO_PLANNED] }),
    },
    { operation: "disables", enabled: true, plan: planWith({ pluginsToDisable: [HELLO_PLANNED] }) },
    {
      operation: "holds down for a dependency",
      enabled: true,
      plan: planWith({
        pluginsToDependencyDisable: [{ ...HELLO_PLANNED, dependency: "dep@mp", kind: "missing" }],
      }),
    },
    {
      operation: "removes with its marketplace",
      enabled: true,
      plan: planWith({
        marketplacesToRemove: [{ scope: "project", marketplace: "mp", plugins: ["hello"] }],
      }),
    },
    { operation: "enables", enabled: false, plan: planWith({ pluginsToEnable: [HELLO_PLANNED] }) },
  ]) {
    test(`AMIG-01: a recorded owner the plan ${operation} is skipped silently`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "planned-skip");
      const legacyBytes = await seedNotMovable(scope, { enabled });
      const log: string[] = [];
      const input = migrationInput(scope.cwd, plan, "reload");

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual({ rows: input.rows, log }, { rows: [], log: [] });
      assert.strictEqual(await readFile(scope.locations.mcpJsonPath, "utf8"), legacyBytes);
    });
  }

  test("AMIG-01: a plan that names only other plugins and marketplaces still moves the owner", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "plan-others");
    await seedNotMovable(scope, {});
    const beta = { ...HELLO_PLANNED, plugin: "beta" };
    const plan = planWith({
      pluginsToUninstall: [beta],
      pluginsToDisable: [beta],
      pluginsToDependencyDisable: [{ ...beta, dependency: "dep@mp", kind: "missing" }],
      pluginsToEnable: [beta],
      marketplacesToRemove: [{ scope: "project", marketplace: "other", plugins: ["hello"] }],
    });
    const log: string[] = [];
    const input = migrationInput(scope.cwd, plan, "reload");

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
    assert.deepStrictEqual(log, ["prepare hello@mp", "commit", "removeLegacy hello@mp"]);
  });

  test("AMIG-01: a git owner moves offline from its warm recorded-sha clone, never the manifest sha", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "git-warm");
    const { cloneDir } = await seedGitOwner(scope, {
      recordedSha: RECORDED_SHA,
      pinned: true,
      cache: "warm",
    });
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

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
    assert.deepStrictEqual(log, ["prepare hello@mp", "commit", "removeLegacy hello@mp"]);
    const adapter = JSON.parse(await readFile(scope.locations.mcpAdapterJsonPath, "utf8")) as {
      readonly mcpServers: Readonly<Record<string, { readonly env: unknown }>>;
    };
    assert.deepStrictEqual(adapter.mcpServers["plugin_hello_srv_"]?.env, {
      CLAUDE_PLUGIN_ROOT: cloneDir,
      CLAUDE_PLUGIN_DATA: path.join(scope.locations.dataRoot, "mp", "hello"),
    });
  });

  for (const { cause, seed } of [
    {
      cause: "a cold clone cache",
      seed: { recordedSha: RECORDED_SHA, pinned: true, cache: "cold" },
    },
    { cause: "a git record without resolvedSha", seed: { pinned: true, cache: "warm" } },
    {
      cause: "a mirror whose HEAD cannot be read, so the resolve throws",
      seed: { recordedSha: RECORDED_SHA, pinned: false, cache: "headless-mirror" },
    },
  ] as const) {
    test(`AMIG-01 / NFR-5: ${cause} gives one source-unreadable row and no write`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "git-unreadable");
      const { legacyBytes } = await seedGitOwner(scope, seed);
      const log: string[] = [];
      const input = migrationInput(scope.cwd);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(
        { rows: input.rows, log },
        { rows: [helloRow("source-unreadable")], log: [] },
      );
      assert.strictEqual(await readFile(scope.locations.mcpJsonPath, "utf8"), legacyBytes);
      await assert.rejects(readFile(scope.locations.mcpAdapterJsonPath), { code: "ENOENT" });
    });
  }

  for (const { source, key, label, write } of [
    {
      source: "the user mcp-adapter.json",
      key: "plugin_hello_srv_",
      label: "user-scope mcp-adapter.json",
      write: async ({ cwd }: Scope): Promise<void> => {
        await writeConfigFile(locationsFor("user", cwd).mcpAdapterJsonPath, {
          plugin_hello_srv_: { command: "theirs" },
        });
      },
    },
    {
      source: "~/.config/mcp/mcp.json",
      key: "plugin_hello_srv_",
      label: "mcp.json",
      write: async ({ home }: Scope): Promise<void> => {
        await writeConfigFile(path.join(home, ".config", "mcp", "mcp.json"), {
          plugin_hello_srv_: { command: "theirs" },
        });
      },
    },
    {
      source: "the project .mcp.json under a key that folds equal",
      key: "plugin-hello-srv-",
      label: "project .mcp.json",
      write: async ({ cwd }: Scope): Promise<void> => {
        await writeConfigFile(path.join(cwd, ".mcp.json"), {
          "plugin-hello-srv-": { url: "https://example.test/mcp" },
        });
      },
    },
  ]) {
    test(`AMIG-01: a full server at the new key in ${source} gives one collision row while another owner still moves`, async (t) => {
      // arrange
      const scope = await createProjectScope(t, "collision");
      await seedTwoMovableOwners(scope);
      await write(scope);
      const log: string[] = [];
      const input = migrationInput(scope.cwd);

      // act
      await migrateLegacyMcpEntries(input, recordingOperations(log));

      // assert
      assert.deepStrictEqual(input.rows, [
        {
          kind: "collision",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          servers: ["srv"],
          key,
          source: label,
        },
        BETA_MOVED,
      ]);
      assert.deepStrictEqual(log, [
        "prepare beta@mp",
        "commit",
        "prepare hello@mp",
        "removeLegacy beta@mp",
      ]);
      assert.strictEqual(
        await readFile(scope.locations.mcpJsonPath, "utf8"),
        `${JSON.stringify({ mcpServers: { srv: legacyEntry("hello") } }, null, 2)}\n`,
      );
    });
  }

  test("AMIG-01: a legacy name the source no longer declares is removed in the same write, with a not-declared row", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "not-declared");
    const { locations } = scope;
    await seedNotMovable(scope, { legacyName: "gone" });
    const stateBytes = await readFile(locations.stateJsonPath);
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual(input.rows, [helloRemoved("gone", "not-declared")]);
    assert.deepStrictEqual(log, ["mcp-adapter.json", "mcp.json"]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
    assert.strictEqual(
      await readFile(locations.mcpAdapterJsonPath, "utf8"),
      freshAdapterText(locations, path.join(scope.cwd, "mp-src"), {
        plugin_hello_srv_: { plugin: "hello", fields: { command: "srv" } },
      }),
    );
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
  });

  test("AMIG-01: a source that resolves partially available for another component moves its servers and keeps the record", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "partial-lsp");
    const { locations } = scope;
    await seedNotMovable(scope, { lsp: true });
    const stateBytes = await readFile(locations.stateJsonPath);
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual(input.rows, [HELLO_MOVED]);
    assert.deepStrictEqual(log, ["mcp-adapter.json", "mcp.json"]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
  });

  test("AMIG-01: an unsupported server is removed and not written, the rest move, and the record becomes partially installed", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "unsupported-feature");
    const { locations } = scope;
    const marketplaceRoot = await seedDroppedServerOwner(scope);
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual(input.rows, [
      HELLO_MOVED,
      helloRemoved("live", "unsupported-feature", "ws"),
    ]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
    assert.strictEqual(
      await readFile(locations.mcpAdapterJsonPath, "utf8"),
      freshAdapterText(locations, marketplaceRoot, {
        plugin_hello_srv_: { plugin: "hello", fields: { command: "srv" } },
      }),
    );
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins, {
      hello: {
        ...pluginRecord(marketplaceRoot, "hello", ["srv"]),
        compatibility: {
          installable: false,
          notes: [],
          supported: ["mcpServers"],
          unsupported: ["mcpServers"],
        },
        updatedAt: MOVED_AT,
      },
    });
  });

  test("AMIG-01: a record already partially installed for its MCP servers is not stamped again", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "unsupported-recorded");
    const { cwd, locations } = scope;
    const marketplace = await seedMarketplace(cwd, {
      hello: { servers: { srv: { command: "srv" }, live: WS_SERVER } },
    });
    const record = pluginRecord(marketplace.marketplaceRoot, "hello", ["srv"]);
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        hello: {
          ...record,
          compatibility: {
            ...record.compatibility,
            installable: false,
            unsupported: ["mcpServers"],
          },
        },
      }),
    );
    await writeLegacy(locations, { srv: legacyEntry("hello") });
    const stateBytes = await readFile(locations.stateJsonPath);
    const log: string[] = [];
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual(input.rows, [HELLO_MOVED]);
    assert.deepStrictEqual(log, ["mcp-adapter.json", "mcp.json"]);
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
  });

  test("AMIG-01: a plugin whose MCP config is malformed has every legacy entry removed, none written, and its inventory emptied", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "malformed");
    const marketplace = await seedMarketplace(cwd, {
      hello: { servers: { srv: { command: 42 } } },
    });
    await seedState(
      locations,
      stateWith(cwd, marketplace, {
        hello: pluginRecord(marketplace.marketplaceRoot, "hello", ["srv", "old"]),
      }),
    );
    await writeLegacy(locations, { srv: legacyEntry("hello"), old: legacyEntry("hello") });
    const log: string[] = [];
    const input = migrationInput(cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual(input.rows, [
      helloRemoved("srv", "malformed"),
      helloRemoved("old", "malformed"),
    ]);
    assert.deepStrictEqual(log, ["state.json", "mcp.json"]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
      "mcp.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins, {
      hello: { ...pluginRecord(marketplace.marketplaceRoot, "hello", []), updatedAt: MOVED_AT },
    });
  });

  test("AMIG-01: a disabled record's legacy entries are removed with no server written and no record change", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "disabled");
    const { locations } = scope;
    await seedNotMovable(scope, { enabled: false });
    const stateBytes = await readFile(locations.stateJsonPath);
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual(input.rows, [helloRemoved("srv", "disabled")]);
    assert.deepStrictEqual(log, ["mcp.json"]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBytes);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
      "mcp.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
  });

  test("AMIG-01: a disabled owner whose legacy removal fails gets a stopped row", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "disabled-remove-throws");
    await seedNotMovable(scope, { enabled: false });
    const input = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(
      input,
      writeRecordingOperations(scope.locations, [], "removeLegacyMcpEntries"),
    );

    // assert
    assert.deepStrictEqual(input.rows, [
      {
        kind: "stopped",
        scope: "project",
        detail: "hello@mp: injected removeLegacyMcpEntries failure",
      },
    ]);
  });

  test("AMIG-02: a plugin with a dropped server writes mcp-adapter.json, then state.json, then mcp.json", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "order-dropped");
    await seedDroppedServerOwner(scope);
    const log: string[] = [];

    // act
    await migrateLegacyMcpEntries(
      migrationInput(scope.cwd),
      writeRecordingOperations(scope.locations, log),
    );

    // assert
    assert.deepStrictEqual(log, ["mcp-adapter.json", "state.json", "mcp.json"]);
  });

  test("AMIG-02: a plain move writes mcp-adapter.json, then mcp.json", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "order-plain");
    await seedPlainMoveOwner(scope);
    const log: string[] = [];

    // act
    await migrateLegacyMcpEntries(
      migrationInput(scope.cwd),
      writeRecordingOperations(scope.locations, log),
    );

    // assert
    assert.deepStrictEqual(log, ["mcp-adapter.json", "mcp.json"]);
  });

  test("AMIG-02: a legacy removal that fails once leaves both files holding the server, and the next two runs finish then write nothing", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "unfinished");
    const { locations } = scope;
    await seedPlainMoveOwner(scope);
    const firstLog: string[] = [];
    const first = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(
      first,
      writeRecordingOperations(locations, firstLog, "removeLegacyMcpEntries"),
    );
    const afterFirst = {
      legacy: await serverKeys(locations.mcpJsonPath),
      adapter: await serverKeys(locations.mcpAdapterJsonPath),
    };
    const secondLog: string[] = [];
    const second = migrationInput(scope.cwd);
    await migrateLegacyMcpEntries(second, writeRecordingOperations(locations, secondLog));
    const settled = await scopeTexts(scope);
    const thirdLog: string[] = [];
    const third = migrationInput(scope.cwd);
    await migrateLegacyMcpEntries(third, writeRecordingOperations(locations, thirdLog));

    // assert
    assert.deepStrictEqual(firstLog, ["mcp-adapter.json"]);
    assert.deepStrictEqual(afterFirst, { legacy: ["srv"], adapter: ["plugin_hello_srv_"] });
    assert.deepStrictEqual(first.rows, [
      {
        kind: "unfinished",
        scope: "project",
        plugin: "hello",
        marketplace: "mp",
        servers: ["srv"],
        detail: "injected removeLegacyMcpEntries failure",
      },
    ]);
    assert.deepStrictEqual(
      { log: secondLog, rows: second.rows },
      {
        log: ["mcp.json"],
        rows: [HELLO_MOVED],
      },
    );
    assert.deepStrictEqual({ log: thirdLog, rows: third.rows }, { log: [], rows: [] });
    assert.deepStrictEqual(await scopeTexts(scope), settled);
  });

  for (const failOnce of ["commitPreparedMcp", "saveState", "removeLegacyMcpEntries"] as const) {
    test(`AMIG-02: a crash in ${failOnce} converges on the next run to the bytes of an uninterrupted run`, async (t) => {
      // arrange
      const reference = await createProjectScope(t, "crash-reference");
      await seedDroppedServerOwner(reference);
      await migrateLegacyMcpEntries(
        migrationInput(reference.cwd),
        writeRecordingOperations(reference.locations, []),
      );
      const scope = await createProjectScope(t, `crash-${failOnce}`);
      await seedDroppedServerOwner(scope);
      const crashed = migrateLegacyMcpEntries(
        migrationInput(scope.cwd),
        writeRecordingOperations(scope.locations, [], failOnce),
      );
      await (failOnce === "saveState"
        ? assert.rejects(crashed, /injected saveState failure/)
        : crashed);

      // act
      await migrateLegacyMcpEntries(
        migrationInput(scope.cwd),
        writeRecordingOperations(scope.locations, []),
      );

      // assert
      assert.deepStrictEqual(await scopeTexts(scope), await scopeTexts(reference));
    });
  }

  test("AMIG-01: the half-done state finishes with one entry under the new key, none under the old name, and no adapter write", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "half-done");
    const { locations } = scope;
    const marketplaceRoot = await seedPlainMoveOwner(scope);
    const adapterText = freshAdapterText(locations, marketplaceRoot, {
      plugin_hello_srv_: { plugin: "hello", fields: { command: "srv" } },
    });
    await writeFile(locations.mcpAdapterJsonPath, adapterText);
    const log: string[] = [];
    const input = migrationInput(scope.cwd);

    // act
    await migrateLegacyMcpEntries(input, writeRecordingOperations(locations, log));

    // assert
    assert.deepStrictEqual({ log, rows: input.rows }, { log: ["mcp.json"], rows: [HELLO_MOVED] });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), adapterText);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
  });

  test("AMIG-01: a user-scope move drops the old-name disable stub from the project file under the project lock, before the legacy removal", async (t) => {
    // arrange
    const { cwd } = await createProjectScope(t, "user-project-stub");
    const user = await seedUserMoveOwner(cwd, PROJECT_STUBS_TEXT);
    const log: string[] = [];
    const input = { ...migrationInput(cwd), scope: "user" } as const;

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(
      { rows: input.rows, notices: input.notices, log },
      {
        rows: [USER_HELLO_MOVED],
        notices: [
          {
            kind: "leftover-removed",
            scope: "project",
            file: "mcp-adapter.json",
            plugin: "hello",
            server: "srv",
          },
        ],
        log: ["prepare hello@mp", "commit", "removeProjectStubs hello@mp", "removeLegacy hello@mp"],
      },
    );
    assert.strictEqual(
      await readFile(locationsFor("project", cwd).mcpAdapterJsonPath, "utf8"),
      '{\n  "mcpServers": {\n    "other": {\n      "disabled": true\n    }\n  }\n}\n',
    );
    assert.strictEqual(await readFile(user.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
  });

  test("AMIG-02: a held project lock keeps a user owner's legacy entry and project stub with an unfinished row", async (t) => {
    // arrange
    const { cwd } = await createProjectScope(t, "user-project-locked");
    const user = await seedUserMoveOwner(cwd, PROJECT_STUBS_TEXT);
    const legacyBytes = await readFile(user.mcpJsonPath, "utf8");
    const project = locationsFor("project", cwd);
    await mkdir(project.extensionRoot, { recursive: true });
    await holdStateLock(t, project);
    const log: string[] = [];
    const input = { ...migrationInput(cwd), scope: "user" } as const;

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(
      { rows: input.rows, log },
      {
        rows: [
          {
            kind: "unfinished",
            scope: "user",
            plugin: "hello",
            marketplace: "mp",
            servers: ["srv"],
            detail:
              "Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.",
          },
        ],
        log: ["prepare hello@mp", "commit"],
      },
    );
    assert.strictEqual(await readFile(project.mcpAdapterJsonPath, "utf8"), PROJECT_STUBS_TEXT);
    assert.strictEqual(await readFile(user.mcpJsonPath, "utf8"), legacyBytes);
  });

  test("AMIG-01: a user-scope move with no project stub under its old names never takes the project lock", async (t) => {
    // arrange
    const { cwd } = await createProjectScope(t, "user-no-project-stub");
    const user = await seedUserMoveOwner(cwd, '{"mcpServers":{"other":{"disabled":true}}}\n');
    const log: string[] = [];
    const input = { ...migrationInput(cwd), scope: "user" } as const;

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(
      { rows: input.rows, notices: input.notices, log },
      {
        rows: [USER_HELLO_MOVED],
        notices: [],
        log: ["prepare hello@mp", "commit", "removeLegacy hello@mp"],
      },
    );
    assert.strictEqual(await pathExists(locationsFor("project", cwd).extensionRoot), false);
    assert.strictEqual(await readFile(user.mcpJsonPath, "utf8"), EMPTY_MCP_JSON);
  });

  test("AMIG-01: a user-scope move keeps the project stub under an old name that a project .mcp.json still defines", async (t) => {
    // arrange
    const { cwd } = await createProjectScope(t, "user-project-live-stub");
    await seedUserMoveOwner(cwd, PROJECT_STUBS_TEXT);
    await writeConfigFile(path.join(cwd, ".mcp.json"), { srv: { command: "theirs" } });
    const log: string[] = [];
    const input = { ...migrationInput(cwd), scope: "user" } as const;

    // act
    await migrateLegacyMcpEntries(input, recordingOperations(log));

    // assert
    assert.deepStrictEqual(
      { rows: input.rows, notices: input.notices, log },
      {
        rows: [USER_HELLO_MOVED],
        notices: [],
        log: ["prepare hello@mp", "commit", "removeLegacy hello@mp"],
      },
    );
    assert.strictEqual(
      await readFile(locationsFor("project", cwd).mcpAdapterJsonPath, "utf8"),
      PROJECT_STUBS_TEXT,
    );
  });
});
