// AMIG-01 / AMIG-03: a `/reload` moves an installed plugin's MCP server out of
// the legacy `mcp.json` that released builds wrote into `mcp-adapter.json`,
// and tells the user once. The oracle is the bytes a fresh install of the same
// plugin writes to `mcp-adapter.json`: the move re-stages the plugin, so hand
// edits in the legacy entry do not survive.

import assert from "node:assert/strict";
import { access, chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  canonicalCloneUrl,
  pluginCloneKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  parsePluginSource,
  pathSource,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  createInstallOperation,
  getPluginInfo,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { saveConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedLegacyMcpInstall, seedMcpPlugin } from "./mcp-plugin-seed.ts";

import type { NotifyRecord } from "./mcp-plugin-seed.ts";
import type { TestContext } from "node:test";

const COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

async function reload(cwd: string): Promise<NotifyRecord[]> {
  const { session, notifications } = makeCtx();
  await createApplyReconcile({ loadState })({
    ...session,
    cwd,
    reason: "reload",
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });
  return notifications;
}

const MARKER = { _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" } };

/** The plugin's declared servers, as its `.mcp.json` now holds them. */
async function declareServers(
  pluginRoot: string,
  servers: Readonly<Record<string, unknown>>,
): Promise<void> {
  await writeFile(path.join(pluginRoot, ".mcp.json"), JSON.stringify({ mcpServers: servers }));
}

/** Rewrites the legacy `mcp.json` with a marked stdio entry per name, and the record's inventory to match. */
async function seedLegacyNames(cwd: string, names: readonly string[]): Promise<void> {
  const locations = locationsFor("project", cwd);
  const entries = Object.fromEntries(
    names.map((name) => [name, { command: "node", args: [`${name}.js`], ...MARKER }]),
  );
  await writeFile(locations.mcpJsonPath, JSON.stringify({ mcpServers: entries }));
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record);
  record.resources.mcpServers = [...names];
  await saveState(locations.extensionRoot, state);
}

/** The server keys of a scope's `mcp-adapter.json`; none when the file does not exist. */
async function adapterKeys(cwd: string): Promise<readonly string[]> {
  const raw = await readFile(locationsFor("project", cwd).mcpAdapterJsonPath, "utf8").catch(
    () => '{"mcpServers":{}}',
  );
  return Object.keys((JSON.parse(raw) as { mcpServers: Record<string, unknown> }).mcpServers);
}

/** The marked entries left in a scope's `mcp.json`. */
async function markedLegacyNames(cwd: string): Promise<readonly string[]> {
  const raw = await readFile(locationsFor("project", cwd).mcpJsonPath, "utf8");
  const servers = (JSON.parse(raw) as { mcpServers: Record<string, Record<string, unknown>> })
    .mcpServers;
  return Object.keys(servers).filter((name) => servers[name]?._piClaudeMarketplace !== undefined);
}

/**
 * Points `filePath` at a readable file inside a directory the test makes
 * read-only, so the file reads normally and an atomic write to it fails.
 * Returns the directory, which the case unlocks after acting.
 */
async function lockedLink(
  t: TestContext,
  cwd: string,
  filePath: string,
  bytes: string,
): Promise<string> {
  // A 0o555 directory stays writable for uid 0, so the write this helper
  // exists to refuse would succeed. Refuse up front and name the environment.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("lockedLink cannot deny root; run this suite as a non-root user");
  }

  const lockedDirectory = path.join(cwd, "locked");
  const target = path.join(lockedDirectory, path.basename(filePath));
  await mkdir(lockedDirectory, { recursive: true });
  await writeFile(target, bytes, "utf8");
  await rm(filePath, { force: true });
  await symlink(target, filePath);
  t.after(async () => {
    await chmod(lockedDirectory, 0o700).catch(() => undefined);
  });
  await chmod(lockedDirectory, 0o555);
  return lockedDirectory;
}

async function scopeBytes(cwd: string): Promise<readonly Buffer[]> {
  const locations = locationsFor("project", cwd);
  return Promise.all([
    readFile(locations.mcpJsonPath),
    readFile(locations.mcpAdapterJsonPath),
    readFile(locations.stateJsonPath),
  ]);
}

test("AMIG-01: /reload moves an installed plugin's mcp.json entry into mcp-adapter.json under its Claude Code key", async () => {
  await withHermeticEnvironment("mcp-migration-move-", async ({ cwd }) => {
    // arrange
    const { freshAdapterBytes } = await seedLegacyMcpInstall(cwd, "project", {
      command: "node",
      args: ["edited.js"],
      approveTools: true,
      enabled: false,
    });
    const locations = locationsFor("project", cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(await readFile(locations.mcpAdapterJsonPath), freshAdapterBytes);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
  });
});

test("AMIG-01: after the move another /reload changes no bytes and sends no notice", async () => {
  await withHermeticEnvironment("mcp-migration-idempotent-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });
    await reload(cwd);
    const movedBytes = await scopeBytes(cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(await scopeBytes(cwd), movedBytes);
    assert.deepStrictEqual(notifications, []);
  });
});

test("AMIG-03: one notice covers both scopes, project rows first", async () => {
  await withHermeticEnvironment("mcp-migration-scopes-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "user", { command: "node", args: ["v1.js"] });
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          "  srv -> plugin_hello_srv_ (hello) [user]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
  });
});

test("AMIG-01: a migrated plugin whose server declares tool permission rules matches a fresh install and its notice says the rules are not enforced", async () => {
  await withHermeticEnvironment("mcp-migration-tool-rules-", async ({ cwd }) => {
    // arrange
    const { freshAdapterBytes } = await seedLegacyMcpInstall(
      cwd,
      "project",
      { type: "http", url: "https://example.test/mcp" },
      {
        type: "http",
        url: "https://example.test/mcp",
        tools: [{ name: "rule-tool-a7", permission_policy: "always_deny" }],
        toolPermissions: { "rule-tool-b7": "blocked" },
      },
    );
    const locations = locationsFor("project", cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(await readFile(locations.mcpAdapterJsonPath), freshAdapterBytes);
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          'Server "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: tools[].permission_policy, toolPermissions. Its tools run without these rules.',
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
  });
});

/** Writes the project `mcp.json` the released builds left: `srv` marked for `hello@mp`. */
async function writeProjectLegacyEntry(cwd: string): Promise<string> {
  const bytes = `${JSON.stringify(
    {
      mcpServers: {
        srv: {
          command: "node",
          args: ["v1.js"],
          _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
        },
      },
    },
    null,
    2,
  )}\n`;
  await writeFile(locationsFor("project", cwd).mcpJsonPath, bytes);
  return bytes;
}

const UNOWNED_PROJECT_NOTICE: NotifyRecord = {
  message: [
    "Plugin MCP servers in mcp.json need attention.",
    "",
    "Left in mcp.json:",
    "  srv (hello) [project] No plugin installed in the project scope owns it. Install hello@mp or remove it from mcp.json.",
  ].join("\n"),
  severity: "warning",
};

test("AMIG-04: an mcp.json entry with no owning install record stays and the user is warned", async () => {
  await withHermeticEnvironment("mcp-migration-unowned-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"]);
    const legacyBytes = await writeProjectLegacyEntry(cwd);
    const locations = locationsFor("project", cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), legacyBytes);
    await assert.rejects(access(locations.mcpAdapterJsonPath), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [UNOWNED_PROJECT_NOTICE]);
  });
});

test("AMIG-04: a record in the user scope does not own a project mcp.json entry", async () => {
  await withHermeticEnvironment("mcp-migration-other-scope-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["user", "project"]);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    await createInstallOperation(
      hooksRouting,
      createCompletionCache(),
    )({ ...makeCtx().session, scope: "user", cwd, marketplace: "mp", plugin: "hello" });
    const legacyBytes = await writeProjectLegacyEntry(cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.strictEqual(
      await readFile(locationsFor("project", cwd).mcpJsonPath, "utf8"),
      legacyBytes,
    );
    assert.deepStrictEqual(notifications, [UNOWNED_PROJECT_NOTICE]);
  });
});

test("AMIG-04: when claude-plugins.json declares the owner, the reload installs it and sweeps the old entry without an unowned warning", async () => {
  await withHermeticEnvironment("mcp-migration-planned-install-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"]);
    await writeProjectLegacyEntry(cwd);
    const locations = locationsFor("project", cwd);
    await saveConfig(
      locations.configJsonPath,
      {
        marketplaces: { mp: { source: "./mp-src" } },
        plugins: { "hello@mp": { enabled: true } },
      },
      locations.scopeRoot,
    );

    // act
    const notifications = await reload(cwd);

    // assert
    const adapter = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
      readonly mcpServers: Readonly<Record<string, unknown>>;
    };
    assert.deepStrictEqual(Object.keys(adapter.mcpServers), ["plugin_hello_srv_"]);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    assert.deepStrictEqual(
      notifications.map(({ message }) => message),
      [
        [
          "● mp [project]",
          "  ● hello (installed) {requires pi-mcp-adapter}",
          "",
          "Reconcile: 1 success",
        ].join("\n"),
      ],
    );
  });
});

const MANIFEST_SHA = "1111111111111111111111111111111111111111";
const RECORDED_SHA = "2222222222222222222222222222222222222222";

/**
 * Seeds marketplace `mp` whose `hello` has a `url` source pinned to
 * `MANIFEST_SHA`, a project record of it installed at `RECORDED_SHA`, and its
 * legacy `mcp.json` entry, as a released build left a git plugin installed
 * before a marketplace update moved the pin. Returns the recorded-sha clone
 * directory, which nothing creates.
 */
async function seedGitPluginRecord(cwd: string): Promise<string> {
  const source = { source: "url", url: "https://example.test/hello.git", sha: MANIFEST_SHA };
  const parsed = parsePluginSource(source);
  assert.strictEqual(parsed.kind, "url");
  const locations = locationsFor("project", cwd);
  const cloneDir = await locations.pluginCloneDir(
    pluginCloneKey(canonicalCloneUrl(parsed), RECORDED_SHA),
  );
  const marketplaceRoot = path.join(cwd, "mp-src");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "hello", source, version: "1.0.0" }] }),
  );
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          hello: {
            version: "1.0.0",
            resolvedSource: cloneDir,
            resolvedSha: RECORDED_SHA,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["mcpServers"],
              unsupported: [],
            },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: ["srv"],
              hooks: [],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  });
  await writeProjectLegacyEntry(cwd);
  return cloneDir;
}

test("AMIG-01: a git plugin left in place on a cold clone cache moves once its recorded clone exists", async () => {
  await withHermeticEnvironment("mcp-migration-git-cold-", async ({ cwd }) => {
    // arrange
    const cloneDir = await seedGitPluginRecord(cwd);
    const locations = locationsFor("project", cwd);
    const legacyBytes = await readFile(locations.mcpJsonPath, "utf8");

    // act
    const coldNotifications = await reload(cwd);
    const coldLegacy = await readFile(locations.mcpJsonPath, "utf8");
    await mkdir(path.join(cloneDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(cloneDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "hello", version: "1.0.0" }),
    );
    await writeFile(
      path.join(cloneDir, ".mcp.json"),
      JSON.stringify({ mcpServers: { srv: { command: "node", args: ["v1.js"] } } }),
    );
    const warmNotifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(coldNotifications, [
      {
        message: [
          "Plugin MCP servers in mcp.json need attention.",
          "",
          "Left in mcp.json:",
          "  srv (hello) [project] The plugin source is not available offline. Run /claude:plugin reinstall hello@mp to move it.",
        ].join("\n"),
        severity: "warning",
      },
    ]);
    assert.strictEqual(coldLegacy, legacyBytes);
    assert.deepStrictEqual(warmNotifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
    const adapter = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
      readonly mcpServers: Readonly<Record<string, { readonly env: unknown }>>;
    };
    assert.deepStrictEqual(Object.keys(adapter.mcpServers), ["plugin_hello_srv_"]);
    assert.deepStrictEqual(adapter.mcpServers["plugin_hello_srv_"]?.env, {
      CLAUDE_PLUGIN_ROOT: cloneDir,
      CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
  });
});

test("AMIG-01: /reload removes an undeclared server, drops an unsupported one and moves the rest", async () => {
  await withHermeticEnvironment("mcp-migration-removed-", async ({ cwd }) => {
    // arrange
    const { pluginRoot } = await seedLegacyMcpInstall(cwd, "project", {
      command: "node",
      args: ["v1.js"],
    });
    await declareServers(pluginRoot, {
      srv: { command: "node", args: ["v1.js"] },
      live: { type: "ws", url: "wss://example.test/ws" },
    });
    await seedLegacyNames(cwd, ["srv", "live", "gone"]);
    const locations = locationsFor("project", cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(await adapterKeys(cwd), ["plugin_hello_srv_"]);
    assert.deepStrictEqual(await markedLegacyNames(cwd), []);
    const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
    assert.deepStrictEqual(record?.resources.mcpServers, ["srv"]);
    assert.strictEqual(record.compatibility.installable, false);
    assert.ok(record.compatibility.unsupported.includes("mcpServers"));
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          "Removed from mcp.json:",
          "  gone (hello) [project] hello no longer declares it.",
          "  live (hello) [project] {unsupported mcp} ws: pi-mcp-adapter cannot run it.",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "warning",
      },
    ]);
    const info = makeCtx();
    await getPluginInfo({
      ...info.session,
      marketplace: "mp",
      plugin: "hello",
      scope: "project",
      cwd,
    });
    assert.ok(
      info.notifications.some((entry) =>
        entry.message.includes("plugin:hello:live (unsupported ws)"),
      ),
    );
  });
});

test("AMIG-01: a plugin whose MCP config is malformed has all its old entries removed and none written", async () => {
  await withHermeticEnvironment("mcp-migration-malformed-", async ({ cwd }) => {
    // arrange
    const { pluginRoot } = await seedLegacyMcpInstall(cwd, "project", {
      command: "node",
      args: ["v1.js"],
    });
    await seedMcpPlugin(cwd, ["user"]);
    await declareServers(pluginRoot, {
      srv: { command: "node", args: ["v1.js"], timeout: "soon" },
    });
    await seedLegacyNames(cwd, ["srv", "old"]);
    const locations = locationsFor("project", cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(
      (await adapterKeys(cwd)).filter((key) => key.startsWith("plugin_hello_")),
      [],
    );
    assert.deepStrictEqual(await markedLegacyNames(cwd), []);
    const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
    assert.deepStrictEqual(record?.resources.mcpServers, []);
    const malformed =
      "{malformed mcp}: hello's MCP config is not valid, so none of its servers are installed.";
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers removed from mcp.json.",
          "",
          "Removed from mcp.json:",
          `  old (hello) [project] ${malformed}`,
          `  srv (hello) [project] ${malformed}`,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "warning",
      },
    ]);
    const fresh = makeCtx();
    await createInstallOperation(
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
      createCompletionCache(),
    )({ ...fresh.session, scope: "user", cwd, marketplace: "mp", plugin: "hello" });
    assert.ok(fresh.notifications.some((entry) => entry.message.includes("{malformed mcp}")));
    assert.strictEqual(
      (await loadState(locationsFor("user", cwd).extensionRoot)).marketplaces.mp?.plugins.hello,
      undefined,
    );
  });
});

test("AMIG-03: an old-name disable stub removed during the move is listed and makes the notice a warning", async () => {
  await withHermeticEnvironment("mcp-migration-leftover-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });
    await writeFile(
      locationsFor("project", cwd).mcpAdapterJsonPath,
      JSON.stringify({ mcpServers: { srv: { disabled: true } } }),
    );

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          'Removed "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
          "/reload to pick up changes",
        ].join("\n"),
        severity: "warning",
      },
    ]);
  });
});

test("AMIG-02: a filesystem refusal between the two writes loses no server and the next reload finishes the move", async (t) => {
  await withHermeticEnvironment("mcp-migration-refused-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });
    const locations = locationsFor("project", cwd);
    const lockedDirectory = await lockedLink(
      t,
      cwd,
      locations.mcpJsonPath,
      await readFile(locations.mcpJsonPath, "utf8"),
    );

    // act
    const refused = await reload(cwd);
    const afterRefusal = {
      adapter: await adapterKeys(cwd),
      legacy: await markedLegacyNames(cwd),
    };
    await chmod(lockedDirectory, 0o700);
    const finished = await reload(cwd);
    const finishedBytes = await scopeBytes(cwd);
    const settled = await reload(cwd);

    // assert
    assert.deepStrictEqual(afterRefusal, { adapter: ["plugin_hello_srv_"], legacy: ["srv"] });
    // write-file-atomic names its temporary file with a random suffix.
    const refusedStable = refused.map((entry) => ({
      ...entry,
      message: entry.message.replace(/mcp\.json\.\d+/, "mcp.json.<tmp>"),
    }));
    assert.deepStrictEqual(refusedStable, [
      {
        message: [
          "Plugin MCP servers in mcp.json need attention.",
          "",
          "Left in mcp.json:",
          "  srv (hello) [project] The new entries are written, but mcp.json could not be updated: EACCES: permission denied, open 'mcp.json.<tmp>'. The next /reload finishes the move.",
        ].join("\n"),
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual(finished, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
    assert.deepStrictEqual(await markedLegacyNames(cwd), []);
    assert.deepStrictEqual(settled, []);
    assert.deepStrictEqual(await scopeBytes(cwd), finishedBytes);
  });
});
