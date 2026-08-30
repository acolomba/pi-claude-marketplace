import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  parseMcpServers,
  resolvePluginMcpServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/parse.ts";

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  return pluginRoot;
}

describe("parseMcpServers", () => {
  test("returns a complete valid server map unchanged", () => {
    // arrange
    const servers = {
      filesystem: {
        command: "node",
        args: ["filesystem-server.js", "/workspace"],
        env: { LOG_LEVEL: "debug" },
      },
      remote: {
        type: "http",
        url: "https://mcp.example.test/server",
        headers: { authorization: "Bearer token" },
      },
    };
    const expectedServers = {
      filesystem: {
        command: "node",
        args: ["filesystem-server.js", "/workspace"],
        env: { LOG_LEVEL: "debug" },
      },
      remote: {
        type: "http",
        url: "https://mcp.example.test/server",
        headers: { authorization: "Bearer token" },
      },
    };

    // act
    const parsedServers = parseMcpServers(servers, "plugin-manifest mcpServers");

    // assert
    assert.strictEqual(parsedServers, servers);
    assert.deepStrictEqual(parsedServers, expectedServers);
  });
});

describe("resolvePluginMcpServers", () => {
  test("prefers the marketplace entry over the manifest and standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-entry-");
    await writeFile(path.join(pluginRoot, ".mcp.json"), "not standalone json", "utf8");
    const expectedResolution = {
      source: "marketplace-entry",
      servers: {
        entryServer: {
          command: "entry-command",
          args: ["--entry"],
          env: { SOURCE: "entry" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {
        mcpServers: {
          entryServer: {
            command: "entry-command",
            args: ["--entry"],
            env: { SOURCE: "entry" },
          },
        },
      },
      manifest: {
        mcpServers: {
          manifestServer: { command: "manifest-command", args: ["--manifest"] },
        },
      },
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("prefers the plugin manifest over the standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-manifest-");
    await writeFile(path.join(pluginRoot, ".mcp.json"), "not standalone json", "utf8");
    const expectedResolution = {
      source: "plugin-manifest",
      servers: {
        manifestServer: {
          command: "manifest-command",
          args: ["--manifest"],
          env: { SOURCE: "manifest" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {
        mcpServers: {
          manifestServer: {
            command: "manifest-command",
            args: ["--manifest"],
            env: { SOURCE: "manifest" },
          },
        },
      },
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("accepts a wrapped standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-wrapped-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          wrappedServer: {
            command: "wrapped-command",
            args: ["--wrapped"],
            env: { SOURCE: "wrapped" },
          },
        },
      }),
      "utf8",
    );
    const expectedResolution = {
      source: "standalone",
      servers: {
        wrappedServer: {
          command: "wrapped-command",
          args: ["--wrapped"],
          env: { SOURCE: "wrapped" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("accepts an unwrapped standalone document", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-unwrapped-");
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({
        unwrappedServer: {
          command: "unwrapped-command",
          args: ["--unwrapped"],
          env: { SOURCE: "unwrapped" },
        },
      }),
      "utf8",
    );
    const expectedResolution = {
      source: "standalone",
      servers: {
        unwrappedServer: {
          command: "unwrapped-command",
          args: ["--unwrapped"],
          env: { SOURCE: "unwrapped" },
        },
      },
    };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });

  test("returns none when no declaration exists", async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "mcp-parse-none-");
    const expectedResolution = { source: "none", servers: {} };

    // act
    const resolution = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot,
    });

    // assert
    assert.deepStrictEqual(resolution, expectedResolution);
  });
});
