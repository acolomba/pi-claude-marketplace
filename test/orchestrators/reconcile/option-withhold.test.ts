import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { describe, type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  withholdUnreadableOptionServers,
  withholdUserOptionServersAtStartup,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/option-withhold.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { McpConfigNotice } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const OPTION = "${PI_CLAUDE_MARKETPLACE_OPTION_0123456789abcdef}";

function pluginRecord(userConfig: unknown): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/x",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: ["keyed"],
      hooks: [],
      workflows: [],
    },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userConfig,
  };
}

function stateWith(cwd: string, plugins: Record<string, PluginInstallRecord>): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "mp", ".claude-plugin", "marketplace.json"),
        marketplaceRoot: path.join(cwd, "mp"),
        plugins,
      },
    },
  };
}

function entry(plugin: string, withheld?: Record<string, unknown>): Record<string, unknown> {
  return {
    command: "srv",
    args: [OPTION],
    ...(withheld !== undefined && { disabled: true }),
    _piClaudeMarketplace: {
      plugin,
      marketplace: "mp",
      ...(withheld !== undefined && { withheld }),
    },
  };
}

function configText(servers: Record<string, unknown>): string {
  return `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`;
}

async function projectScope(t: TestContext): Promise<{
  readonly cwd: string;
  readonly adapterPath: string;
  readonly extensionRoot: string;
}> {
  const { cwd } = await createHermeticEnvironment(t, "option-withhold-step-");
  const locations = locationsFor("project", cwd);
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  return { cwd, adapterPath: locations.mcpAdapterJsonPath, extensionRoot: locations.extensionRoot };
}

describe("withholdUnreadableOptionServers", () => {
  test("D-PG10-25: withholds the unreadable record's entry, restores the readable one's, and keeps the absent owner's", async (t) => {
    // arrange
    const { cwd, adapterPath, extensionRoot } = await projectScope(t);
    await saveState(
      extensionRoot,
      stateWith(cwd, {
        bad: pluginRecord("token=secret"),
        good: pluginRecord({ t: { type: "string", title: "T", description: "T.", default: "x" } }),
      }),
    );
    const stateBytes = await readFile(path.join(extensionRoot, "state.json"), "utf8");
    await writeFile(
      adapterPath,
      configText({ bad: entry("bad"), good: entry("good", {}), gone: entry("gone", {}) }),
    );
    const notices: McpConfigNotice[] = [];

    // act
    await withholdUnreadableOptionServers({ scope: "project", cwd, notices });

    // assert
    assert.deepStrictEqual(notices, []);
    assert.strictEqual(
      await readFile(adapterPath, "utf8"),
      configText({ bad: entry("bad", {}), good: entry("good"), gone: entry("gone", {}) }),
    );
    assert.strictEqual(await readFile(path.join(extensionRoot, "state.json"), "utf8"), stateBytes);
  });

  test("D-PG10-25: takes no lock and writes nothing in a scope with no state", async (t) => {
    // arrange
    const { cwd, adapterPath } = await projectScope(t);
    const text = configText({ bad: entry("bad") });
    await writeFile(adapterPath, text);
    const notices: McpConfigNotice[] = [];

    // act
    await withholdUnreadableOptionServers({ scope: "project", cwd, notices });

    // assert
    assert.deepStrictEqual(notices, []);
    assert.strictEqual(await readFile(adapterPath, "utf8"), text);
    assert.deepStrictEqual(await readdir(path.dirname(adapterPath)), ["mcp-adapter.json"]);
  });

  test("D-PG10-25: writes no file in a scope with state and no mcp-adapter.json", async (t) => {
    // arrange
    const { cwd, adapterPath, extensionRoot } = await projectScope(t);
    await saveState(extensionRoot, stateWith(cwd, { bad: pluginRecord("token=secret") }));
    const notices: McpConfigNotice[] = [];

    // act
    await withholdUnreadableOptionServers({ scope: "project", cwd, notices });

    // assert
    assert.deepStrictEqual(notices, []);
    await assert.rejects(readFile(adapterPath, "utf8"), { code: "ENOENT" });
  });

  test("D-PG10-25: passes on the comments notice of the file it rewrote", async (t) => {
    // arrange
    const { cwd, adapterPath, extensionRoot } = await projectScope(t);
    await saveState(extensionRoot, stateWith(cwd, { bad: pluginRecord("token=secret") }));
    await writeFile(adapterPath, `// mine\n${configText({ bad: entry("bad") })}`);
    const notices: McpConfigNotice[] = [];

    // act
    await withholdUnreadableOptionServers({ scope: "project", cwd, notices });

    // assert
    assert.deepStrictEqual(notices, [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
    ]);
  });
});

async function userScope(t: TestContext): Promise<{
  readonly cwd: string;
  readonly adapterPath: string;
}> {
  const { cwd } = await createHermeticEnvironment(t, "option-withhold-startup-");
  const locations = locationsFor("user", cwd);
  await saveState(locations.extensionRoot, stateWith(cwd, { bad: pluginRecord("token=secret") }));
  return { cwd, adapterPath: locations.mcpAdapterJsonPath };
}

describe("withholdUserOptionServersAtStartup", () => {
  test("D-PG10-25: withholds the user scope's entry before any session event", async (t) => {
    // arrange
    const { cwd, adapterPath } = await userScope(t);
    await writeFile(adapterPath, configText({ bad: entry("bad") }));

    // act
    await withholdUserOptionServersAtStartup(cwd, {});

    // assert
    assert.strictEqual(await readFile(adapterPath, "utf8"), configText({ bad: entry("bad", {}) }));
  });

  test("D-PG10-25: leaves a commented user file to the load", async (t) => {
    // arrange
    const { cwd, adapterPath } = await userScope(t);
    const text = `// mine\n${configText({ bad: entry("bad") })}`;
    await writeFile(adapterPath, text);

    // act
    await withholdUserOptionServersAtStartup(cwd, {});

    // assert
    assert.strictEqual(await readFile(adapterPath, "utf8"), text);
  });

  test("D-MB-12: writes nothing in a pi-subagents child", async (t) => {
    // arrange
    const { cwd, adapterPath } = await userScope(t);
    const text = configText({ bad: entry("bad") });
    await writeFile(adapterPath, text);

    // act
    await withholdUserOptionServersAtStartup(cwd, { PI_SUBAGENT_CHILD: "1" });

    // assert
    assert.strictEqual(await readFile(adapterPath, "utf8"), text);
  });

  test("NFR-2: logs a failure and resolves", async (t) => {
    // arrange
    const { cwd, adapterPath } = await userScope(t);
    const text = configText({ bad: entry("bad") });
    await writeFile(adapterPath, text);
    await writeFile(path.join(locationsFor("user", cwd).extensionRoot, "state.json"), "{ not json");
    const debugLines = captureDebugLog(t);

    // act
    await withholdUserOptionServersAtStartup(cwd, {});

    // assert
    assert.strictEqual(debugLines.length, 1);
    assert.match(
      debugLines[0] ?? "",
      /^\[mcp\] plugin options: held-back servers not synced at load: /,
    );
    assert.strictEqual(await readFile(adapterPath, "utf8"), text);
  });
});
